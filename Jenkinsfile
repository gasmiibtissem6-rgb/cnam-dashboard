
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

        stage('Docker Build') {
            steps {
                sh 'docker build -t cnam-dashboard:latest .'
            }
        }
    }

    post {
        success {
            echo 'CNAM Dashboard : pipeline CI + Docker réussie !'
        }
        failure {
            echo 'CNAM Dashboard : pipeline CI + Docker échouée.'
        }
    }
}
