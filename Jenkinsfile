pipeline {
    agent any

    environment {
        BUN_INSTALL = "${HOME}/.bun"
        PATH = "${BUN_INSTALL}/bin:${PATH}"
        DEPLOY_DIR = "/path/to/your/app/on/vm"
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
                    bun install
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'bun run build'
            }
        }

        stage('Test') {
            steps {
                sh 'bun test'
            }
        }

        stage('Deploy to VM') {
            steps {
                sh '''
                    # Stop the current application
                    pm2 stop smart-air-port || true
                    
                    # Copy build files to deployment directory
                    cp -R dist/* ${DEPLOY_DIR}/
                    cp package.json ${DEPLOY_DIR}/
                    
                    # Install dependencies in production mode
                    cd ${DEPLOY_DIR}
                    bun install --production
                    
                    # Restart the application
                    pm2 start dist/main.js --name smart-air-port
                    
                    # Save PM2 configuration
                    pm2 save
                '''
            }
        }

        stage('Update Build Info') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'ced0805f-8694-4c16-b243-e13c5e4b07dd', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins CI"

                        # Create build info file
                        echo "Build completed at $(date)" > build-info.txt
                        echo "Commit: $(git rev-parse HEAD)" >> build-info.txt
                        
                        git add build-info.txt
                        git commit -m "Update build info from Jenkins [skip ci]" || echo "No changes to commit"
                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/Aliexe-code/smart-air-port.git HEAD:main || echo "Nothing to push"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed!'
        }
    }
}
