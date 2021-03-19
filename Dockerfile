# Start from a node image
FROM node:lts-alpine AS builder
# Set the working directory
WORKDIR /home/node
# Copy all of the required files into the working directory
COPY ["./", "./"]
# Install and build all the required node packages
RUN npm install && npm run build:prod

# Start from a node image
FROM node:lts-alpine
# Set the node environment variable to production
ENV NODE_ENV production
# Set the working directory
WORKDIR /home/node/image-bot
# Copy the package.json files into the working directory
COPY --from=builder ["/home/node/package*.json", "./"]
# Copy all of the required files into the working directory
COPY --from=builder ["/home/node/built/", "./built"]
# Install the required node packages for production
RUN npm install --only=prod
# Allow the log file to be created
RUN chmod a+w .
# Set the user as the node user
USER node
# Run the npm start command
CMD ["npm", "run", "start:prod"]