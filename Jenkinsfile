pipeline {
    agent any

    environment {
        BUN_INSTALL = "${HOME}/.bun"
        PATH = "${BUN_INSTALL}/bin:${PATH}"
        DEPLOY_DIR = "/var/www/smart-air-port"
        REMOTE_USER = "deploy"
        REMOTE_HOST = "your-server-ip-or-hostname"
        SSH_CREDENTIALS_ID = "smart-air-port-ssh-key"
        NODE_ENV = "production"
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup Environment') {
            steps {
                sh '''
                    # Install Bun if not already installed
                    if ! command -v bun &> /dev/null; then
                        curl -fsSL https://bun.sh/install | bash
                    else
                        echo "Bun is already installed"
                    fi
                    
                    # Install dependencies
                    bun install
                '''
            }
        }

        stage('Lint') {
            steps {
                sh 'bun run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'bun test'
            }
        }

        stage('Build') {
            steps {
                sh 'bun run build'
            }
        }

        stage('Prepare Deployment') {
            steps {
                sh '''
                    # Create deployment package
                    mkdir -p deploy
                    cp -r dist deploy/
                    cp package.json deploy/
                    cp bun.lock deploy/
                    cp -r src/i18n deploy/
                    
                    # Create .env file for production
                    cat > deploy/.env << EOL
NODE_ENV=production
PORT=3001
MONGO_URI=${MONGO_URI}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_PUBLIC_KEY=${STRIPE_PUBLIC_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
PAYMOB_API_KEY=${PAYMOB_API_KEY}
PAYMOB_MERCHANT_ID=${PAYMOB_MERCHANT_ID}
PAYMOB_HMAC_SECRET=${PAYMOB_HMAC_SECRET}
PAYMOB_CARD_INTEGRATION_ID=${PAYMOB_CARD_INTEGRATION_ID}
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
REDIS_TTL=${REDIS_TTL}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOL
                    
                    # Create deployment archive
                    tar -czf smart-air-port-deploy.tar.gz -C deploy .
                '''
            }
        }

        stage('Deploy to Server') {
            steps {
                sshagent(credentials: [env.SSH_CREDENTIALS_ID]) {
                    sh '''
                        # Copy deployment package to server
                        scp -o StrictHostKeyChecking=no smart-air-port-deploy.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:~/
                        
                        # Execute deployment commands on remote server
                        ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} "
                            # Stop the current application
                            pm2 stop smart-air-port || true
                            
                            # Backup current deployment
                            if [ -d ${DEPLOY_DIR} ]; then
                                mv ${DEPLOY_DIR} ${DEPLOY_DIR}_backup_$(date +%Y%m%d%H%M%S)
                            fi
                            
                            # Create deployment directory
                            mkdir -p ${DEPLOY_DIR}
                            
                            # Extract deployment package
                            tar -xzf ~/smart-air-port-deploy.tar.gz -C ${DEPLOY_DIR}
                            
                            # Install production dependencies
                            cd ${DEPLOY_DIR}
                            bun install --production
                            
                            # Start the application with PM2
                            pm2 start dist/main.js --name smart-air-port --env production
                            
                            # Save PM2 configuration
                            pm2 save
                            
                            # Cleanup
                            rm ~/smart-air-port-deploy.tar.gz
                            
                            # Keep only the 3 most recent backups
                            ls -dt ${DEPLOY_DIR}_backup_* | tail -n +4 | xargs -r rm -rf
                        "
                    '''
                }
            }
        }

        stage('Update Build Info') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'github-credentials', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins CI"

                        # Create build info file
                        echo "Build completed at $(date)" > build-info.txt
                        echo "Commit: $(git rev-parse HEAD)" >> build-info.txt
                        echo "Build number: ${BUILD_NUMBER}" >> build-info.txt
                        
                        git add build-info.txt
                        git commit -m "Update build info from Jenkins [skip ci]" || echo "No changes to commit"
                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/Aliexe-code/smart-air-port.git HEAD:main || echo "Nothing to push"
                    '''
                }
            }
        }
    }

    post {
        always {
            // Clean workspace after build
            cleanWs()
        }
        success {
            echo 'Deployment successful!'
            // You can add Slack/Email notifications here
        }
        failure {
            echo 'Deployment failed!'
            // You can add Slack/Email notifications here
        }
    }
}
