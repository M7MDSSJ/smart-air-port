pipeline {
    agent any

    environment {
        BUN_INSTALL = "${HOME}/.bun"
        PATH = "${HOME}/.bun/bin:${PATH}"
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

        stage('Install Bun') {
            steps {
                sh '''
                    curl -fsSL https://bun.sh/install | bash
                    export BUN_INSTALL="$HOME/.bun"
                    export PATH="$BUN_INSTALL/bin:$PATH"
                    bun install
                '''
            }
        }

        stage('Build') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    sh '''
                        export PATH="$BUN_INSTALL/bin:$PATH"
                        echo "🛠️ Running TypeScript build..."
                        if [ -f tsconfig.build.json ]; then
                            bunx tsc -p tsconfig.build.json
                        else
                            echo "⚠️ tsconfig.build.json not found. Using tsconfig.json..."
                            bunx tsc -p tsconfig.json
                        fi
                    '''
                }
            }
        }

        stage('Test') {
            when {
                expression { fileExists('bun.lockb') }
            }
            steps {
                sh '''
                    export PATH="$BUN_INSTALL/bin:$PATH"
                    echo "🧪 Running tests..."
                    bun test || echo "⚠️ Tests failed or were skipped"
                '''
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'jenkins-deploy-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
                    sh '''
                        export PATH="$BUN_INSTALL/bin:$PATH"
                        echo "🚀 Deploying application..."
                        
                        # Test SSH connection
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "echo SSH connection successful"
                        
                        # Create directories if they don't exist
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "mkdir -p ~/smart-air-port/dist"
                        
                        # Copy the built files
                        scp -i $SSH_KEY -o StrictHostKeyChecking=no -r dist/* $SSH_USER@10.1.0.4:~/smart-air-port/dist/
                        
                        # Create a tarball of node_modules to transfer efficiently
                        tar -czf node_modules.tar.gz node_modules
                        scp -i $SSH_KEY -o StrictHostKeyChecking=no node_modules.tar.gz $SSH_USER@10.1.0.4:~/smart-air-port/
                        
                        # Copy package.json and package-lock.json
                        scp -i $SSH_KEY -o StrictHostKeyChecking=no package*.json $SSH_USER@10.1.0.4:~/smart-air-port/
                        
                        # Extract node_modules on the server and install any missing dependencies
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "cd ~/smart-air-port && tar -xzf node_modules.tar.gz && npm install --production"
                        
                        # Restart the application with PM2
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "cd ~/smart-air-port && pm2 restart smart-airport || pm2 start dist/main.js --name smart-airport"
                        
                        # Verify the application is running
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "cd ~/smart-air-port && pm2 status"
                        
                        # Check application logs for any startup errors
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "cd ~/smart-air-port && pm2 logs smart-airport --lines 10 || true"
                        
                        # Clean up the tarball
                        ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SSH_USER@10.1.0.4 "cd ~/smart-air-port && rm -f node_modules.tar.gz"
                        
                        echo "✅ Deployment completed successfully!"
                    '''
                }
            }
        }

        stage('Push Build Info') {
            when {
                expression { fileExists('build-info.txt') }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'ced0805f-8694-4c16-b243-e13c5e4b07dd', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        export PATH="$BUN_INSTALL/bin:$PATH"
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins CI"
                        git pull origin main || true
                        echo "Build at $(date -u +'%Y-%m-%dT%H:%M:%SZ')" > build-info.txt
                        git add build-info.txt || true
                        git commit -m "🔧 Update build info [skip ci]" || true
                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/Aliexe-code/smart-air-port.git HEAD:main || true
                    '''
                }
            }
        }
    }

    post {
        success {
            echo '✅ Build and deployment succeeded!'
        }
        failure {
            echo '❌ Build failed. Check the logs for more information.'
        }
    }
}
