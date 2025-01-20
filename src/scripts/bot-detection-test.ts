import puppeteer from 'puppeteer-core'
import 'dotenv/config'
import path from 'path'
import fs from 'fs/promises'

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
    console.log(`Found ${addresses.length} properties to process`);
    
    // Process addresses sequentially to avoid overwhelming the service
    for (const address of addresses) {
      console.log(`\nProcessing property: ${address}`);
      try {
        await runBotDetectionTest(address);
        // Add a delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      } catch (error) {
        console.error(`Failed to process ${address}:`, error);
        // Continue with next address even if one fails
        continue;
      }
    }
    
    console.log('\nFinished processing all properties');
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
      30000, // Increased timeout to 30 seconds
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
      await new Promise(resolve => setTimeout(resolve, 2000));
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
    if (page) {
      try {
        await page._client().send('Rebrowser.finishRun');
      } catch (finishError) {
        console.error('Failed to finish run:', finishError);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Failed to close browser:', closeError);
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