# Start from a node image
FROM node:11
# Set the node environment variable to production
ENV NODE_ENV production
# Set the working directory
WORKDIR /home/node/image-bot
# Copy all of the required files into the working directory
COPY [".", "."]
# Install all the required node packages
RUN npm install --only=prod
# Allow the log file to be created
RUN chmod a+w .
# Set the user as the node user
USER node
# Run the node command
CMD ["node", "."]