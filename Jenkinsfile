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
                    bun run build
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    export BUN_INSTALL="$HOME/.bun"
                    export PATH="$BUN_INSTALL/bin:$PATH"
                    bun test
                '''
            }
        }

        stage('Push Changes to GitHub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'your-git-credentials-id', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                    sh '''
                        git config user.email "jenkins@example.com"
                        git config user.name "Jenkins CI"

                        # Example file modification
                        echo "Build at $(date)" > build-info.txt
                        git add build-info.txt
                        git commit -m "Add build info from Jenkins"
                        git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/Aliexe-code/smart-air-port.git HEAD:main
                    '''
                }
            }
        }
    }
}
