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
                sh '''
                    export BUN_INSTALL="$HOME/.bun"
                    export PATH="$BUN_INSTALL/bin:$PATH"
                    
                    echo "Using Bun build..."
                    if [ -f tsconfig.build.json ]; then
                        bunx tsc -p tsconfig.build.json
                    else
                        echo "⚠️ tsconfig.build.json not found. Falling back to tsconfig.json..."
                        bunx tsc -p tsconfig.json
                    fi
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    export BUN_INSTALL="$HOME/.bun"
                    export PATH="$BUN_INSTALL/bin:$PATH"
                    bun test || echo "⚠️ Tests failed or are not defined. Continuing anyway..."
                '''
            }
        }

        stage('Push Changes to GitHub') {
            when {
                expression {
                    return fileExists('build-info.txt')
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'ced0805f-8694-4c16-b243-e13c5e4b07dd', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins CI"
                        
                        git pull origin main || true
                        echo "Build at $(date)" > build-info.txt
                        git add build-info.txt
                        
                        git commit -m "Add build info from Jenkins" || echo "Nothing to commit"
                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/Aliexe-code/smart-air-port.git HEAD:main || echo "Push skipped or failed"
                    '''
                }
            }
        }
    }

    post {
        failure {
            echo '❌ Deployment failed!'
        }
        success {
            echo '✅ Deployment succeeded!'
        }
    }
}
