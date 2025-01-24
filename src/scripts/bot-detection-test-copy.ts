import puppeteer from 'puppeteer-core'
import 'dotenv/config'
import path from 'path'
import fs from 'fs/promises'
import cliProgress from 'cli-progress'
import PQueue from 'p-queue'
import { LockFile } from 'proper-lockfile';

// Add these constants at the top of the file, after the imports
const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 10,
  DELAY_BETWEEN_REQUESTS: 6000 / 10, // 6000ms = 10 requests per minute
  RETRY_DELAY: 6000, // 1 minute wait if rate limited
  MAX_RETRIES: 3
};

// Add this constant at the top with other rate limits
const LONG_WAIT = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

async function runWithTimeout(promise, timeout, errorMessage) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

function cleanAddress(fullAddress: string | null): string {
  if (!fullAddress) {
    console.warn('Received null or undefined address');
    return '';
  }
  
  return fullAddress
    // Remove ID prefixes
    .replace(/^ID:\d+\//, '')
    // Remove Lot numbers at start
    .replace(/^Lot \d+,\s*/, '')
    // Remove parenthesized lot numbers
    .replace(/^\(Lot \d+\)\s*/, '')
    // Clean up any double spaces and trim
    .replace(/\s+/g, ' ')
    .trim();
}

async function appendValuationData(address: string, valuationData: any) {
  // Add file locking mechanism
  const lockfile = require('proper-lockfile');
  const searchJsonPath = path.join(process.cwd(), 'src/scripts/search.json');
  
  try {
    // Acquire lock before reading/writing
    await lockfile.lock(searchJsonPath);
    
    const fileContent = await fs.readFile(searchJsonPath, 'utf-8');
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    const searchData = JSON.parse(cleanContent);
    
    // Find the property by comparing cleaned addresses
    const propertyIndex = searchData.findIndex(
      (property) => cleanAddress(property.address.display.fullAddress) === address
    );

    if (propertyIndex !== -1) {
      // Add valuation data to the property with source information
      searchData[propertyIndex].valuationData = {
        source: "property.com.au",
        status: valuationData.status || 'found',
        confidence: valuationData.confidence,
        estimatedValue: valuationData.estimatedValue,
        pricePerMeter: valuationData.pricePerMeter,
        priceRange: valuationData.priceRange,
        lastUpdated: valuationData.lastUpdated,
        rental: {
          confidence: valuationData.rental.confidence,
          value: valuationData.rental.value,
          period: valuationData.rental.period,
          message: valuationData.rental.message
        }
      };
      
      try {
        // Write updated data back to file with proper formatting
        await fs.writeFile(
          searchJsonPath, 
          JSON.stringify(searchData, null, 2),
          'utf8'
        );
        console.log(`Successfully updated valuation data for ${address}`);
      } catch (writeError) {
        console.error('Error writing to search.json:', writeError);
      }
    } else {
      console.log(`Property not found with address: ${address}`);
    }
  } finally {
    // Release lock
    await lockfile.unlock(searchJsonPath);
  }
}

async function getAllAddresses(): Promise<string[]> {
  try {
    const searchJsonPath = path.join(process.cwd(), 'src/scripts/search.json');
    console.log('Reading from:', searchJsonPath);
    
    const fileContent = await fs.readFile(searchJsonPath, 'utf-8');
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    
    try {
      const searchData = JSON.parse(cleanContent);
      
      if (!Array.isArray(searchData)) {
        console.error('search.json must contain an array');
        return [];
      }

      // Add more detailed logging
      console.log(`Total records in search.json: ${searchData.length}`);
      
      // Filter out invalid entries and clean addresses
      const addresses = searchData
        .filter(property => {
          if (!property?.address?.display?.fullAddress) {
            console.warn('Found property with missing address structure:', property);
            return false;
          }
          return true;
        })
        .map(property => {
          const address = cleanAddress(property.address.display.fullAddress);
          if (!address) {
            console.warn('Address cleaned to empty string:', property.address.display.fullAddress);
            return null;
          }
          return address;
        })
        .filter(Boolean); // Remove null values
      
      console.log(`Successfully loaded ${addresses.length} valid addresses`);
      
      // Log first few addresses as sample
      if (addresses.length > 0) {
        console.log('\nSample addresses:');
        addresses.slice(0, 3).forEach((addr, i) => {
          console.log(`${i + 1}. ${addr}`);
        });
      }
      
      return addresses;
      
    } catch (parseError) {
      console.error('Failed to parse search.json. Content sample:', cleanContent.slice(0, 100));
      throw parseError;
    }
  } catch (error) {
    console.error('Error getting addresses:', error);
    return [];
  }
}

async function createScrapeInstance(address: string, progressBar: any, queueId: number) {
  let browser;
  let page;
  
  try {
    progressBar.increment(0, { status: `Queue ${queueId}: Connecting to Rebrowser` });
    
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://ws.rebrowser.net/?apiKey=${process.env.REBROWSER_API_KEY}`,
      defaultViewport: null
    });

    page = await browser.newPage();
    
    // Set a longer timeout for navigation
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);

    progressBar.increment(0, { status: `Queue ${queueId}: Navigating to property.com.au` });
    await page.goto('https://property.com.au', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for the page to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 2000));

    progressBar.increment(0, { status: `Queue ${queueId}: Clicking search button` });
    await page.waitForSelector('[data-testid="home-page-multi-intent-search-modal-button"]', {
      visible: true,
      timeout: 30000
    });
    await page.click('[data-testid="home-page-multi-intent-search-modal-button"]');

    // Wait for search input with retry
    let searchInput = null;
    for (let i = 0; i < 3; i++) {
      try {
        searchInput = await page.waitForSelector('#multi-intent-search-modal-default-screen', {
          visible: true,
          timeout: 10000
        });
        break;
      } catch (error) {
        if (i === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    progressBar.increment(0, { status: `Queue ${queueId}: Typing address: ${address}` });
    
    // Clear input field first
    await page.evaluate(() => {
      const input = document.querySelector('#multi-intent-search-modal-default-screen') as HTMLInputElement;
      if (input) input.value = '';
    });

    // Type address with delay
    for (const char of address) {
      await page.type('#multi-intent-search-modal-default-screen', char, { delay: 100 });
    }

    // Wait for and verify suggestions
    progressBar.increment(0, { status: `Queue ${queueId}: Waiting for suggestions` });
    try {
      const suggestionSelector = '.mapOptionToListNode__OptionContainer-sc-lnbl9x-1';
      await page.waitForSelector(suggestionSelector, { 
        visible: true,
        timeout: 20000 
      });
      
      // Get all suggestions
      const suggestions = await page.$$eval(suggestionSelector, elements => 
        elements.map(el => el.textContent?.trim())
      );
      
      console.log(`Queue ${queueId} - Found ${suggestions.length} suggestions for: "${address}"`);
      console.log(`Suggestions:`, suggestions);

      if (suggestions.length > 0) {
        await page.click(suggestionSelector);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw new Error('No suggestions found');
      }

      console.log(`Queue ${queueId} - Clicked suggestion, waiting for navigation...`);
      await page.click('.mapOptionToListNode__OptionContainer-sc-lnbl9x-1');

      // Wait for navigation with longer timeout
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0',
        timeout: 60000  // 60 seconds
      });

      // Now go straight to waiting for the valuation data
      console.log(`Queue ${queueId} - Waiting for valuation data...`);
      await page.waitForSelector('[data-testid="valuation-sub-brick-confidence"]', { 
        timeout: 60000 
      });

      console.log(`Queue ${queueId} - Navigation complete, waiting additional 5s for dynamic content...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`Queue ${queueId} - Starting data extraction...`);
      const propertyInfo = await page.evaluate(() => {
        const confidence = document.querySelector('[data-testid="valuation-sub-brick-confidence"]')?.textContent;
        const estimatedValue = document.querySelector('[data-testid="valuation-sub-brick-price-text"]')?.textContent;
        const pricePerMeter = document.querySelector('.kRRzuL')?.textContent;
        const priceRange = document.querySelector('[data-testid="valuation-sub-brick-estimate-range"]')?.textContent;
        const lastUpdated = document.querySelector('.ibzsLI')?.textContent;
        
        const sections = document.querySelectorAll('.PropertyValuationSubBrick__PropertyValuationSubBrickContainer-sc-1uh1dob-0');
        const rentalSection = sections[1];
        const rentalConfidence = rentalSection?.querySelector('[data-testid="valuation-sub-brick-confidence"]')?.textContent;
        const rentalValue = rentalSection?.querySelector('[data-testid="valuation-sub-brick-price-text"]')?.textContent;
        const rentalPeriod = rentalSection?.querySelector('.PropertyValuationSubBrick__PriceSubtitleText-sc-1uh1dob-4')?.textContent;
        const rentalMessage = rentalSection?.querySelector('.PropertyValuationSubBrick__EmptyEstimateMessage-sc-1uh1dob-11')?.textContent;
        
        return {
          confidence,
          estimatedValue,
          pricePerMeter,
          priceRange,
          lastUpdated,
          rental: {
            confidence: rentalConfidence,
            value: rentalValue,
            period: rentalPeriod,
            message: rentalMessage
          }
        };
      });

      console.log(`Queue ${queueId} - Data extraction complete:`, propertyInfo);

      // Append the data to search.json
      await appendValuationData(address, propertyInfo);
      progressBar.increment(1, { status: `Queue ${queueId}: Completed` });
      return propertyInfo;

    } catch (error) {
      console.error(`Queue ${queueId} - Error processing ${address}:`, error.message);
      throw error;
    }

  } finally {
    if (browser) {
      progressBar.increment(0, { status: `Queue ${queueId}: Cleaning up` });
      try {
        // Graceful cleanup
        if (page) {
          try {
            await page._client().send('Rebrowser.finishRun').catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (e) {
            // Ignore finishRun errors
          }
        }
        await browser.close().catch(() => {});
      } catch (cleanupError) {
        console.error(`Queue ${queueId} - Failed to cleanup browser:`, cleanupError);
      }
    }
  }
}

async function processAllProperties() {
  try {
    const addresses = await getAllAddresses();
    const totalProperties = addresses.length;
    
    console.log('\n=== Starting Property Processing ===');
    console.log(`Total Properties to Process: ${totalProperties}`);
    console.log('===================================\n');
    
    const multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: 'Queue {queueId} [{bar}] {percentage}% | {status} | {value}/{total} Properties',
    }, cliProgress.Presets.shades_classic);

    // Create separate progress bars for each queue
    const progressBars = Array.from({ length: 3 }, (_, i) => 
      multibar.create(Math.ceil(totalProperties / 3), 0, { 
        queueId: i + 1,
        status: 'Starting...' 
      })
    );

    // Create 3 separate queues for parallel processing
    const queues = Array.from({ length: 3 }, () => new PQueue({ concurrency: 1 }));
    const failedAddresses: { address: string | null, reason: string }[] = [];
    let successCount = 0;
    let lastRequestTimes = [0, 0, 0]; // Track last request time for each queue

    // Distribute addresses among queues
    const addressChunks = addresses.reduce((acc, addr, i) => {
      acc[i % 3].push(addr);
      return acc;
    }, [[], [], []] as string[][]);

    // Process each queue independently
    const queuePromises = addressChunks.map(async (addressChunk, queueIndex) => {
      for (const address of addressChunk) {
        if (!address) {
          progressBars[queueIndex].increment(1, { status: 'Skipped invalid address' });
          failedAddresses.push({ address: null, reason: 'Invalid or null address' });
          continue;
        }

        await queues[queueIndex].add(async () => {
          let attempts = 0;
          while (attempts < RATE_LIMIT.MAX_RETRIES) {
            attempts++;
            try {
              await createScrapeInstance(address, progressBars[queueIndex], queueIndex + 1);
              successCount++;
              lastRequestTimes[queueIndex] = Date.now();
              break;
            } catch (error) {
              progressBars[queueIndex].increment(0, { 
                status: `Queue ${queueIndex + 1}: Attempt ${attempts} failed` 
              });
              
              // Handle different types of errors with appropriate wait times
              if (error.message?.includes('net::ERR_CONNECTION_ABORTED')) {
                await new Promise(resolve => setTimeout(resolve, LONG_WAIT));
              } else if (error.message?.includes('500')) {
                await new Promise(resolve => setTimeout(resolve, 30000));
              } else if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.RETRY_DELAY));
              } else {
                const waitTime = Math.min(attempts * 10000, 300000);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }

              if (attempts === RATE_LIMIT.MAX_RETRIES) {
                failedAddresses.push({ address, reason: `Max attempts reached: ${error.message}` });
              }
            }
          }
        });
      }
    });

    // Wait for all queues to complete
    await Promise.all(queuePromises);
    await Promise.all(queues.map(queue => queue.onIdle()));
    multibar.stop();

    // Print summary
    console.log('\n=== Processing Summary ===');
    console.log(`Total Properties: ${totalProperties}`);
    console.log(`Successfully Processed: ${successCount}`);
    console.log(`Failed: ${failedAddresses.length}`);
    
    if (failedAddresses.length > 0) {
      console.log('\nFailed Addresses:');
      console.log('─'.repeat(50));
      failedAddresses.forEach(({ address, reason }, index) => {
        console.log(`${index + 1}. Address: ${address || 'NULL'}`);
        console.log(`   Reason: ${reason}`);
        console.log('─'.repeat(50));
      });
    }

  } catch (error) {
    console.error('Failed to process properties:', error);
  }
}

// Run the script
if (import.meta.url === import.meta.resolve('./bot-detection-test.ts')) {
  processAllProperties()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export default processAllProperties 