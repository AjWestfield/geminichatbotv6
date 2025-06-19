FROM mcr.microsoft.com/playwright:v1.53.0-focal

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]