# Start from a node image
FROM node:11
# Set the working directory
WORKDIR /home/node/image-bot
# Copy all of the required files into the working directory
COPY [".", "."]
# Install all the required node packages
RUN npm install --only=prod
# Set the user as the node user
USER node
# Run the node command
CMD ["node", "."]