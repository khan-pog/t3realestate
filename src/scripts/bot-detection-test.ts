import puppeteer from 'puppeteer-core'
import 'dotenv/config'
import path from 'path'
import fs from 'fs/promises'

// Add these constants at the top of the file, after the imports
const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 20,
  DELAY_BETWEEN_REQUESTS: 3000,
  RETRY_DELAY: 30000,
  MAX_RETRIES: 3
};

// Add this constant at the top with other rate limits
const LONG_WAIT = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

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

async function runWithTimeout(promise, timeout, errorMessage) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

async function appendValuationData(address: string, valuationData: any) {
  try {
    const searchJsonPath = path.join(process.cwd(), 'src/scripts/search.json');
    let searchData;
    
    try {
      const fileContent = await fs.readFile(searchJsonPath, 'utf-8');
      // Remove any potential BOM characters and ensure valid JSON
      const cleanContent = fileContent.replace(/^\uFEFF/, '');
      searchData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing search.json:', parseError);
      return;
    }
    
    // Find the property with matching address
    const propertyIndex = searchData.findIndex(
      (property) => property.address.display.fullAddress === address
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
  } catch (error) {
    console.error('Failed to update search.json:', error);
  }
}

async function getAllAddresses(): Promise<string[]> {
  try {
    const searchJsonPath = path.join(process.cwd(), 'src/scripts/search.json');
    const fileContent = await fs.readFile(searchJsonPath, 'utf-8');
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    const searchData = JSON.parse(cleanContent);
    
    return searchData.map(property => property.address.display.fullAddress);
  } catch (error) {
    console.error('Error getting addresses:', error);
    return [];
  }
}

async function processAllProperties() {
  try {

    const addresses = await getAllAddresses();
    const totalProperties = addresses.length;
    
    console.log('\n=== Starting Property Processing ===');
    console.log(`Total Properties to Process: ${totalProperties}`);
    console.log('===================================\n');
    
    let processedCount = 0;
    let successCount = 0;
    let lastRequestTime = 0;
    let currentProfileIndex = 0;
    
    const failedAddresses: { address: string | null, reason: string }[] = [];
    
    for (const address of addresses) {
      processedCount++;
      
      // Add validation for null/empty addresses
      if (!address) {
        console.error(`\n[${processedCount}/${totalProperties}] ERROR: Invalid address (null or empty)`);
        failedAddresses.push({ address: null, reason: 'Invalid or null address' });
        console.error('Skipping to next property...\n');
        continue;
      }
      
      const progressPercent = ((processedCount / totalProperties) * 100).toFixed(1);
      console.log(`\n[${processedCount}/${totalProperties}] (${progressPercent}%) Processing: ${address}`);
      console.log('─'.repeat(50));
      
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < RATE_LIMIT.DELAY_BETWEEN_REQUESTS) {
        const delayNeeded = RATE_LIMIT.DELAY_BETWEEN_REQUESTS - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${delayNeeded}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }
      
      let success = false;
      let attempts = 0;
      
      while (!success && attempts < 25) {
        attempts++;
        try {
          if (typeof address !== 'string') {
            throw new Error(`Invalid address format: ${JSON.stringify(address)}`);
          }
          
          await runBotDetectionTest(address);
          success = true;
          successCount++;
          lastRequestTime = Date.now();
        } catch (error) {
          console.error(`Attempt ${attempts} failed for ${address}:`, error.message);
          
          if (attempts >= 25) {
            failedAddresses.push({ address, reason: `Max attempts (25) reached: ${error.message}` });
            break;
          }
          
          // If property not found, log it and move on
          if (error.message?.includes('No property found')) {
            console.log(`\nNo property found for address: ${address}`);
            // Create and save blank valuation data
            const blankValuationData = {
              status: 'not_found',
              confidence: null,
              estimatedValue: null,
              pricePerMeter: null,
              priceRange: null,
              lastUpdated: null,
              rental: {
                confidence: null,
                value: null,
                period: null,
                message: null
              }
            };
            await appendValuationData(address, blankValuationData);
            success = true; // Move to next property
            continue;
          }
          
          // Handle different types of errors with appropriate wait times
          if (error.message?.includes('net::ERR_CONNECTION_ABORTED')) {
            const waitUntil = new Date(Date.now() + LONG_WAIT);
            console.log(`Connection aborted. Waiting 1 hour until ${waitUntil.toLocaleTimeString()}...`);
            await new Promise(resolve => setTimeout(resolve, LONG_WAIT));
          } else if (error.message?.includes('500')) {
            console.log(`Server error (500). Waiting 15 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
          } else if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
            console.log(`Rate limit detected. Waiting ${RATE_LIMIT.RETRY_DELAY/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.RETRY_DELAY));
          } else {
            const waitTime = Math.min(attempts * 5000, 120000);
            console.log(`Error occurred. Waiting ${waitTime/1000} seconds before retry ${attempts}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    
    // Print summary at the end
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

async function runBotDetectionTest(address: string) {
  let browser;
  let page;
  
  try {
    console.log('Connecting to Rebrowser...')
    
    browser = await runWithTimeout(
      puppeteer.connect({
        browserWSEndpoint: `wss://ws.rebrowser.net/?apiKey=${process.env.REBROWSER_API_KEY}`,
        defaultViewport: null
      }),
      15000,
      'Failed to connect to Rebrowser'
    );

    // Get existing page or create new one
    page = (await runWithTimeout(browser.pages(), 5000, 'Failed to get pages'))[0] || 
           (await runWithTimeout(browser.newPage(), 5000, 'Failed to create new page'));

    console.log('Navigating to property.com.au...')
    await runWithTimeout(
      page.goto('https://property.com.au', {
        waitUntil: 'networkidle0',
        timeout: 30000
      }),
      35000,
      'Failed to navigate to property.com.au'
    );

    // Wait for the button and click it
    await runWithTimeout(
      page.waitForSelector('[data-testid="home-page-multi-intent-search-modal-button"]'),
      10000,
      'Failed to find search modal button'
    );
    await page.click('[data-testid="home-page-multi-intent-search-modal-button"]');

    // Wait for the search input to appear
    await runWithTimeout(
      page.waitForSelector('#multi-intent-search-modal-default-screen'),
      10000,
      'Failed to find search input'
    );
    
    // Type the address
    await page.type('#multi-intent-search-modal-default-screen', address);

    // After typing the address, check if suggestion appears
    try {
      await runWithTimeout(
        page.waitForSelector('.mapOptionToListNode__OptionContainer-sc-lnbl9x-1', { visible: true }),
        20000,
        'Failed to find suggestion'
      );
      
      // Wait longer for the suggestion to appear and click it
      await new Promise(resolve => setTimeout(resolve, 10000));
      await page.click('.mapOptionToListNode__OptionContainer-sc-lnbl9x-1');

      // Wait a moment for any animations to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Extract property information
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

      // Log the results
      console.log('\nProperty Value Information:')
      console.log('-------------------------')
      console.log(`Confidence: ${propertyInfo.confidence}`)
      console.log(`Estimated Value: ${propertyInfo.estimatedValue}`)
      console.log(`Price per m²: ${propertyInfo.pricePerMeter}`)
      console.log(`Price Range: ${propertyInfo.priceRange}`)
      console.log(`Last Updated: ${propertyInfo.lastUpdated}`)
      
      console.log('\nRental Information:')
      console.log('-------------------------')
      console.log(`Confidence: ${propertyInfo.rental.confidence}`)
      console.log(`Estimated Rental: ${propertyInfo.rental.value}`)
      console.log(`Period: ${propertyInfo.rental.period}`)
      if (propertyInfo.rental.message) {
        console.log(`Message: ${propertyInfo.rental.message}`)
      }

      // Append the data to search.json
      await appendValuationData(address, propertyInfo);

    } catch (suggestionError) {
      console.log(`\nNo property found for address: ${address}`);
      // Create blank valuation data
      const blankValuationData = {
        status: 'not_found',
        confidence: null,
        estimatedValue: null,
        pricePerMeter: null,
        priceRange: null,
        lastUpdated: null,
        rental: {
          confidence: null,
          value: null,
          period: null,
          message: null
        }
      };
      
      // Append blank data to search.json
      await appendValuationData(address, blankValuationData);
      return;
    }

  } catch (error) {
    console.error('Test failed:', error)
    throw error;
  } finally {
    // Clean up resources regardless of success or failure
    if (page && browser) {
      try {
        console.log('Finishing Rebrowser run...');
        await page._client().send('Rebrowser.finishRun');
        console.log('Closing browser...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await browser.close();
        console.log('Browser session cleaned up');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (cleanupError) {
        console.error('Failed to cleanup browser session:', cleanupError);
      }
    }
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

export default runBotDetectionTest 