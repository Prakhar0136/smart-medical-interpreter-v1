# Start from a lightweight Python image
FROM python:3.10-slim

# Install system libraries needed by OpenCV and EasyOCR
RUN apt-get update && apt-get install -y \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json .
RUN npm install

# Copy all remaining backend files
COPY . .

# Start the server
CMD ["node", "server.js"]