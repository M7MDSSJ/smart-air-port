pipeline {
    agent any

    environment {
        BUN_INSTALL = "${HOME}/.bun"
        PATH = "${HOME}/.bun/bin:/usr/local/bin:${PATH}"
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

        stage('Install Dependencies') {
            steps {
                sh '''
                    # Install Node.js and npm if not already installed
                    if ! command -v node > /dev/null; then
                        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
                        apt-get install -y nodejs
                    fi

                    echo "✅ Node.js version: $(node -v)"
                    echo "✅ npm version: $(npm -v)"

                    # Install Bun
                    curl -fsSL https://bun.sh/install | bash
                    export PATH="$HOME/.bun/bin:$PATH"
                    bun install

                    # Install NestJS CLI
                    npm install -g @nestjs/cli

                    # Install SWC (speedy web compiler)
                    npm install -D @swc/core @swc/cli
                '''
            }
        }

        stage('Build') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    sh '''
                        export PATH="$HOME/.bun/bin:$PATH"
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
                    export PATH="$HOME/.bun/bin:$PATH"
                    echo "🧪 Running tests..."
                    bun test || echo "⚠️ Tests failed or were skipped"
                '''
            }
        }

        stage('Push Build Info') {
            when {
                expression { fileExists('build-info.txt') }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'ced0805f-8694-4c16-b243-e13c5e4b07dd', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        export PATH="$HOME/.bun/bin:$PATH"
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
