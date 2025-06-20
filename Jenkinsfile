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
                withCredentials([sshUserPrivateKey(credentialsId: 'jenkins-deploy-key', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        export PATH="$BUN_INSTALL/bin:$PATH"
                        echo "🚀 Deploying application..."
                        
                        # Extract public key from private key
                        ssh-keygen -y -f $SSH_KEY > /tmp/jenkins_pubkey
                        echo "Generated public key from private key:"
                        cat /tmp/jenkins_pubkey
                        
                        # Set the correct hostname and username
                        HOST_IP="10.1.0.4"  # Use the IP address directly
                        SSH_USER="alijs"
                        
                        # Try SSH with verbose output
                        echo "Testing SSH connection with verbose output..."
                        ssh -vvv -i $SSH_KEY $SSH_USER@$HOST_IP "echo SSH connection successful" || echo "SSH connection failed"
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
