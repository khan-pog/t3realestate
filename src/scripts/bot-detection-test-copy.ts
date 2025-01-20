import puppeteer from "puppeteer-core";

const URL = "https://property.com.au";
const BROWSER_WS = "wss://brd-customer-hl_778ac6d6-zone-isp_proxy1:42ycuy7r0afh@brd.superproxy.io:9222";

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toBookingTimestamp(date) {
  return date.toISOString().split('T')[0];
}

const search_text = "New York";
const now = new Date();
const check_in = toBookingTimestamp(addDays(now, 1));
const check_out = toBookingTimestamp(addDays(now, 2));

// This sample code searches Booking for acommodation in selected location
// and dates, then returns names, prices and rating for available options.

run(URL);

async function run(url) {
  console.log("Connecting to browser...");
  const browser = await puppeteer.connect({
    browserWSEndpoint: BROWSER_WS,
  });
  console.log("Connected! Navigate to site...");
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  console.log("Navigated! Interacting with page...");

  // Wait for the button and click it
  await page.waitForSelector('[data-testid="home-page-multi-intent-search-modal-button"]');
  await page.click('[data-testid="home-page-multi-intent-search-modal-button"]');

  // Wait for the search input to appear
  await page.waitForSelector('#multi-intent-search-modal-default-screen');
  
  // Type some dummy text
  await page.type('#multi-intent-search-modal-default-screen', '16 kayleen court burdell');

  // Wait for the suggestion to appear and click it
  await page.waitForSelector('.mapOptionToListNode__OptionContainer-sc-lnbl9x-1');
  await page.click('.mapOptionToListNode__OptionContainer-sc-lnbl9x-1');

  // Wait a moment for any animations to complete
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Extract property value information
  const propertyInfo = await page.evaluate(() => {
    const confidence = document.querySelector('[data-testid="valuation-sub-brick-confidence"]')?.textContent;
    const estimatedValue = document.querySelector('[data-testid="valuation-sub-brick-price-text"]')?.textContent;
    const pricePerMeter = document.querySelector('.kRRzuL')?.textContent;
    const priceRange = document.querySelector('[data-testid="valuation-sub-brick-estimate-range"]')?.textContent;
    const lastUpdated = document.querySelector('.ibzsLI')?.textContent;
    
    // Get rental information from the second section
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

  console.log('\nProperty Value Information:');
  console.log('-------------------------');
  console.log(`Confidence: ${propertyInfo.confidence}`);
  console.log(`Estimated Value: ${propertyInfo.estimatedValue}`);
  console.log(`Price per m²: ${propertyInfo.pricePerMeter}`);
  console.log(`Price Range: ${propertyInfo.priceRange}`);
  console.log(`Last Updated: ${propertyInfo.lastUpdated}`);
  
  console.log('\nRental Information:');
  console.log('-------------------------');
  console.log(`Confidence: ${propertyInfo.rental.confidence}`);
  console.log(`Estimated Rental: ${propertyInfo.rental.value}`);
  console.log(`Period: ${propertyInfo.rental.period}`);
  if (propertyInfo.rental.message) {
    console.log(`Message: ${propertyInfo.rental.message}`);
  }

  await browser.close();
}

async function close_popup(page) {
  try {
    const close_btn = await page.waitForSelector('[aria-label="Dismiss sign-in info."]', { timeout: 25000, visible: true });
    console.log("Popup appeared! Closing...");
    await close_btn.click();
    console.log("Popup closed!");
  } catch (e) {
    console.log("Popup didn't appear.");
  }
}

async function interact(page) {
  console.log("Waiting for search form...");
  const search_input = await page.waitForSelector('[data-testid="destination-container"] input', { timeout: 60000 });
  console.log("Search form appeared! Filling it...");
  await search_input.type(search_text);
  await page.click('[data-testid="searchbox-dates-container"] button');
  await page.waitForSelector('[data-testid="searchbox-datepicker-calendar"]');
  await page.click(`[data-date="${check_in}"]`);
  await page.click(`[data-date="${check_out}"]`);
  console.log("Form filled! Submitting and waiting for result...");
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]);
};

async function parse(page) {
  return await page.$$eval('[data-testid="property-card"]', els => els.map(el => {
    const name = el.querySelector('[data-testid="title"]')?.innerText;
    const price = el.querySelector('[data-testid="price-and-discounted-price"]')?.innerText;
    const review_score = el.querySelector('[data-testid="review-score"]')?.innerText ?? '';
    const [score_str, , , reviews_str = ''] = review_score.split('\n');
    const score = parseFloat(score_str) || score_str;
    const reviews = parseInt(reviews_str.replace(/\D/g, '')) || reviews_str;
    return { name, price, score, reviews };
  }));
} //working with bright data