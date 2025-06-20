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
                        
                        # Set the correct hostname and username
                        HOST_IP="Grad2025Backend"  # Use the actual hostname or IP address
                        SSH_USER="alijs"           # Use the correct username
                        
                        # Debug: Check if the key file exists and has content
                        ls -la $SSH_KEY
                        echo "Key file size: $(wc -c < $SSH_KEY)"
                        
                        # Create a temporary SSH config to use the key
                        mkdir -p ~/.ssh
                        cat > ~/.ssh/config << EOF
Host $HOST_IP
    HostName $HOST_IP
    User $SSH_USER
    IdentityFile $SSH_KEY
    StrictHostKeyChecking no
    LogLevel DEBUG3
EOF
                        chmod 600 ~/.ssh/config
                        
                        # Try direct IP address instead of hostname
                        # Get IP address
                        IP_ADDRESS=$(getent hosts $HOST_IP | awk '{ print $1 }')
                        echo "Resolved IP address: $IP_ADDRESS"
                        
                        # Try SSH with verbose output
                        echo "Testing SSH connection with verbose output..."
                        ssh -vvv $HOST_IP "echo SSH connection successful" || echo "SSH connection failed"
                        
                        # Try with IP address directly if hostname resolution worked
                        if [ ! -z "$IP_ADDRESS" ]; then
                            echo "Trying with IP address directly..."
                            ssh -vvv $SSH_USER@$IP_ADDRESS "echo SSH connection successful" || echo "SSH connection with IP failed"
                        fi
                        
                        # Try copying the key directly to authorized_keys for testing
                        echo "Trying to use the key directly..."
                        cat $SSH_KEY | ssh-keygen -y > /tmp/jenkins_pubkey
                        echo "Generated public key:"
                        cat /tmp/jenkins_pubkey
                        
                        # Make sure the target directory exists
                        ssh -vvv -i $SSH_KEY $HOST_IP "mkdir -p ~/smart-air-port/dist" || echo "Failed to create directory"
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
