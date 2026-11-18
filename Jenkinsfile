
pipeline {
    agent {
        label 'docker-agent'
    }

    options {
        timestamps()
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

                        sh '''
                            set +x

                            echo "Verification du token SonarQube Jenkins..."

                            if [ -z "$SONAR_AUTH_TOKEN" ]; then
                                echo "ERREUR : SONAR_AUTH_TOKEN absent"
                                exit 1
                            fi

                            HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
    -u "$SONAR_AUTH_TOKEN:" \
    "http://localhost:9000/api/v2/analysis/version")

                            echo "Authentification SonarQube : HTTP $HTTP_CODE"

                            if [ "$HTTP_CODE" != "200" ]; then
                                echo "ERREUR : authentification SonarQube refusee"
                                exit 1
                            fi

                            echo "Authentification SonarQube OK"
                        '''

                        withEnv(["SCANNER_HOME=${scannerHome}"]) {
                            sh '''
                                set +x

                                export SONAR_TOKEN="$SONAR_AUTH_TOKEN"

"$SCANNER_HOME/bin/sonar-scanner" \
    -Dsonar.host.url=http://localhost:9000
                            '''
                        }
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
        withCredentials([
            string(credentialsId: 'cnam-supabase-url', variable: 'VITE_SUPABASE_URL'),
            string(credentialsId: 'cnam-supabase-publishable-key', variable: 'VITE_SUPABASE_PUBLISHABLE_KEY')
        ]) {
            sh '''
                set +x

                if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
                    echo "ERREUR : variables Supabase manquantes"
                    exit 1
                fi

                docker build \
                    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
                    -t cnam-dashboard:latest .
            '''
        }
    }
}

        stage('Security Scan - Trivy') {
            steps {
                sh '''
                    /opt/homebrew/bin/trivy image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        cnam-dashboard:latest
                '''
            }
        }

        stage('Deploy Docker') {
            steps {
                sh '''
                    docker rm -f cnam-dashboard-app 2>/dev/null || true

                    docker run -d \
                        --name cnam-dashboard-app \
                        -p 3000:80 \
                        --restart unless-stopped \
                        cnam-dashboard:latest
                '''
            }
        }
    }

    post {
        success {
            echo 'CNAM Dashboard : pipeline DevSecOps reussie.'
        }

        failure {
            echo 'CNAM Dashboard : pipeline DevSecOps echouee.'
        }

        always {
            echo 'Execution du pipeline terminee.'
        }
    }
}

