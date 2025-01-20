import puppeteer from 'puppeteer-core'
import { env } from '../env'
import * as Sentry from "@sentry/nextjs"

async function runTests() {
  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://ws.rebrowser.net/?apiKey=${env.REBROWSER_API_KEY}`,
      defaultViewport: null
    })

    // Get existing page or create new one
    const page = (await browser.pages())[0] || (await browser.newPage())

    // Disable unnecessary resource loading
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image') {
        req.abort()
      } else {
        req.continue()
      }
    })

    // Run your tests here
    await page.goto('http://localhost:3000')
    
    // Example test: Check if the gallery title exists
    const title = await page.$eval('nav', el => el.textContent)
    console.log('Gallery title found:', title)

    // Example test: Check authentication flow
    const signInButton = await page.$('button:has-text("Sign In")')
    if (signInButton) {
      console.log('Sign in button found')
    }

    // Properly close the session
    await page._client().send('Rebrowser.finishRun')
    await browser.close()

  } catch (error) {
    console.error('Test failed:', error)
    Sentry.captureException(error)
    process.exit(1)
  }
}

runTests().catch(console.error) 