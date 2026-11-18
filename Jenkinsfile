
pipeline {
    agent {
        label 'docker-mac'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'docker --version'
                sh '/opt/homebrew/bin/trivy --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('ESLint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('TypeScript') {
            steps {
                sh 'npx tsc --noEmit'
            }
        }

        stage('Tests') {
            steps {
                sh 'npm test -- --run'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        
        
stage('SonarQube Analysis') {
    steps {
        script {
            def scannerHome = tool 'SonarScanner'
            withSonarQubeEnv('SonarQube-CNAM') {
                sh """
                    "${scannerHome}/bin/sonar-scanner" \
                    -Dsonar.token="\$SONAR_AUTH_TOKEN"
                """
            }
        }
    }
}
stage('Quality Gate') {
    steps {
        timeout(time: 10, unit: 'MINUTES') {
            waitForQualityGate abortPipeline: true
        }
    }
}


        stage('Docker Build') {
            steps {
                sh 'docker build -t cnam-dashboard:latest .'
            }
        }

        stage('Security Scan - Trivy') {
            steps {
                sh '/opt/homebrew/bin/trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 cnam-dashboard:latest'
            }
        }


stage('Deploy Docker') {
    steps {
        sh '''
            set -e

            docker rm -f cnam-dashboard-app 2>/dev/null || true

            docker run -d \
              --name cnam-dashboard-app \
              --restart unless-stopped \
              -p 127.0.0.1:3000:80 \
              cnam-dashboard:latest

            sleep 3

            curl --fail --silent --show-error \
              http://localhost:3000/ > /dev/null
        '''
    }
}

    }

    post {
        success {
            echo 'CNAM Dashboard : pipeline DevSecOps réussie !'
        }
        failure {
            echo 'CNAM Dashboard : pipeline DevSecOps échouée.'
        }
    }
}
