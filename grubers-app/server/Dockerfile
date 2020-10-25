FROM node:12
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

# Create app directory
WORKDIR /home/node/app
# Install app dependencies
COPY package*.json ./
USER node
RUN npm install
# Copy app source code
COPY --chown=node:node . .
# COPY . .
#Expose port and start application
EXPOSE 8080
CMD [ "npm", "start" ]