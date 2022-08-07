# Use NodeJS LTS Slim image
FROM node:lts-slim

# Create app directory 
WORKDIR /app
# Mount volume to store all config files
VOLUME /app/config
# Mount volume with the base docker compose file
VOLUME /app/docker-compose.yaml
# Mount volume to create docker compose file
VOLUME /app/docker-multi.yaml

# Install app dependencies
COPY package.json ./
RUN npm install

# Define number of UEs
ENV NUM_UE="1"
# Define number of gNBs
ENV NUM_GNB="1"
# Set Config file name
ENV CONFIG_FILE="tester.yaml"

# Copy remaning files
COPY . .

# Run JS file with Node
CMD [ "node", "index.js" ]
