class EmailService {
    constructor(providers) {
      this.providers = providers;
      this.activeProviderIndex = 0;
      this.emailHistory = new Set();
      this.rateLimit = 5; // max 5 emails per minute
      this.emailSentCount = 0;
      this.rateLimitWindowStart = Date.now();
    }
  
    logStatus(message) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  
    async sendEmail(email) {
      // Check for duplicate emails to ensure idempotency
      if (this.emailHistory.has(email.id)) {
        this.logStatus(`Duplicate email detected, skipping: ${email.id}`);
        return;
      }
  
      let success = false;
      let attempts = 0;
      const maxAttempts = this.providers.length;
  
      while (!success && attempts < maxAttempts) {
        const provider = this.providers[this.activeProviderIndex];
  
        try {
          this.logStatus(`Attempting to send with provider: ${provider.name}`);
          await provider.send(email); // Mock provider email sending
          success = true;
          this.emailHistory.add(email.id);
          this.logStatus(`Email successfully sent: ${email.id}`);
        } catch (error) {
          this.logStatus(`Error sending with ${provider.name}: ${error.message}`);
          this.switchProvider();
          attempts++;
        }
      }  
      if (!success) {
        this.logStatus(`All providers failed to send email: ${email.id}`);
      }
    }
  
    switchProvider() {
      this.activeProviderIndex = (this.activeProviderIndex + 1) % this.providers.length;
      this.logStatus(`Switched to provider: ${this.providers[this.activeProviderIndex].name}`);
    }
  
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }
  
  // Mock provider class for testing
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
  
  // Initialize providers and email service
  const provider1 = new MockEmailProvider('Provider1', 0.7);
  const provider2 = new MockEmailProvider('Provider2', 0.8);
  const emailService = new EmailService([provider1, provider2]);
  
  // Example usage
  const email = { id: 'email1', to: 'test@example.com', subject: 'Hello', body: 'Hello world!' };
  emailService.sendEmail(email);
  