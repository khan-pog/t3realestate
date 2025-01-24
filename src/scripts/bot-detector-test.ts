import puppeteer from 'puppeteer-core'
import 'dotenv/config'

async function runBotDetectionTest() {
  try {
    console.log('Connecting to Rebrowser...')
    
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://ws.rebrowser.net/?apiKey=${process.env.REBROWSER_API_KEY}`,
      defaultViewport: null
    })

    // Get existing page or create new one
    const page = (await browser.pages())[0] || (await browser.newPage())

    console.log('Navigating to realestate.com.au buy page...')
    await page.goto('https://www.realestate.com.au/buy/list-1', {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    console.log('Successfully connected to the website!')

    // Wait for a moment to ensure all elements are loaded
    await new Promise(resolve => setTimeout(resolve, 5000));


    
    // Debug: Print the page content to verify the structure
    const pageContent = await page.content();
    console.log('Page Content:', pageContent);

    // Extract the first property card
    const property = await page.evaluate(() => {
      const card = document.querySelector('.residential-card');
      if (!card) return null;
      
      const rawAddress = card.querySelector('.residential-card__address-heading')?.textContent?.trim();
      
      return {
        address: cleanAddress(rawAddress),
        price: card.querySelector('.property-price')?.textContent?.trim(),
        propertyType: card.querySelector('.dmDgvy p')?.textContent?.trim(),
        features: {
          bedrooms: card.querySelector('[aria-label*="bedrooms"] p')?.textContent?.trim(),
          bathrooms: card.querySelector('[aria-label*="bathrooms"] p')?.textContent?.trim(),
          parking: card.querySelector('[aria-label*="car space"] p')?.textContent?.trim(),
          landSize: card.querySelector('[aria-label*="land size"] p')?.textContent?.trim()
        },
        agent: {
          name: card.querySelector('.agent__name')?.textContent?.trim(),
          agency: card.querySelector('.branding__image')?.getAttribute('alt')
        },
        link: card.querySelector('.residential-card__details-link')?.getAttribute('href'),
        image: card.querySelector('.property-image__img')?.getAttribute('src')
      };
    });

    if (property) {
      console.log('\nProperty Information:')
      console.log('-------------------------')
      console.log(`Address: ${property.address}`)
      console.log(`Price: ${property.price}`)
      console.log(`Type: ${property.propertyType}`)
      console.log('\nFeatures:')
      console.log(`Bedrooms: ${property.features.bedrooms}`)
      console.log(`Bathrooms: ${property.features.bathrooms}`)
      console.log(`Parking: ${property.features.parking}`)
      console.log(`Land Size: ${property.features.landSize}`)
      console.log('\nAgent Details:')
      console.log(`Name: ${property.agent.name}`)
      console.log(`Agency: ${property.agent.agency}`)
      console.log(`\nListing URL: https://www.realestate.com.au${property.link}`)
      console.log(`Image URL: ${property.image}`)
    } else {
      console.log('No property card found')
    }

    // Properly close the session
    await page._client().send('Rebrowser.finishRun')
    await browser.close()
    
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

// Run the test
if (import.meta.url === import.meta.resolve('./bot-detector-test.ts')) {
  runBotDetectionTest()
}

export default runBotDetectionTest