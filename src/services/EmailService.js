const axios = require('axios');
const axiosRetry = require('axios-retry');
const Bottleneck = require('bottleneck');
const CircuitBreaker = require('opossum');

class EmailService {
  constructor(providers) {
    this.providers = providers;
    this.activeProviderIndex = 0;
    this.emailHistory = new Set();
    this.limiter = new Bottleneck({
      maxConcurrent: 5,
      minTime: 1000 * 12, // 12 seconds between each send (5 per minute)
    });

    // Circuit breaker configuration
    this.breaker = new CircuitBreaker(this.sendWithProvider.bind(this), {
      timeout: 10000, // 10 second timeout
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds to reset breaker
    });

    this.breaker.on('open', () => console.log('Circuit breaker OPENED'));
    this.breaker.on('close', () => console.log('Circuit breaker CLOSED'));
    this.breaker.on('halfOpen', () => console.log('Circuit breaker HALF-OPEN'));
  }

  // Method to track email sending status
  logStatus(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  // Method to send email with retry logic and circuit breaker
  async sendEmail(email) {
    if (this.emailHistory.has(email.id)) {
      this.logStatus(`Duplicate email detected, skipping: ${email.id}`);
      return;
    }

    // Submit the email to the rate-limited queue
    this.limiter.schedule(() => this.breaker.fire(email))
      .then(() => {
        this.emailHistory.add(email.id);
        this.logStatus(`Email successfully sent: ${email.id}`);
      })
      .catch((err) => {
        this.logStatus(`Failed to send email after retries: ${email.id}. Error: ${err.message}`);
      });
  }

  // Actual email sending logic with provider fallback
  async sendWithProvider(email) {
    let success = false;
    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (!success && attempts < maxAttempts) {
      const provider = this.providers[this.activeProviderIndex];

      try {
        this.logStatus(`Attempting to send with provider: ${provider.name}`);
        await provider.send(email); // Mock provider email sending
        success = true;
      } catch (error) {
        this.logStatus(`Error sending with ${provider.name}: ${error.message}`);
        this.switchProvider();
        attempts++;
      }
    }

    if (!success) {
      throw new Error('All providers failed.');
    }
  }

  // Switch to the next provider
  switchProvider() {
    this.activeProviderIndex = (this.activeProviderIndex + 1) % this.providers.length;
    this.logStatus(`Switched to provider: ${this.providers[this.activeProviderIndex].name}`);
  }
}

// Mock providers for demonstration
class MockEmailProvider {
  constructor(name, successRate) {
    this.name = name;
    this.successRate = successRate;
  }

  send(email) {
    return new Promise((resolve, reject) => {
      if (Math.random() < this.successRate) {
        resolve(`Email sent by ${this.name}`);
      } else {
        reject(new Error(`Failed to send email by ${this.name}`));
      }
    });
  }
}

// Initialize providers and service
const provider1 = new MockEmailProvider('Provider1', 0.7);
const provider2 = new MockEmailProvider('Provider2', 0.8);
const emailService = new EmailService([provider1, provider2]);

// Example usage
const email = { id: 'email1', to: 'test@example.com', subject: 'Hello', body: 'Hello world!' };
emailService.sendEmail(email);
