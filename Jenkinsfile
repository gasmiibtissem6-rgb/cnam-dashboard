
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Node.js') {
            steps {
                sh 'node --version'
                sh 'npm --version'
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
    }

    post {
        success {
            echo 'CNAM Dashboard : pipeline CI réussie !'
        }
        failure {
            echo 'CNAM Dashboard : pipeline CI échouée.'
        }
    }
}
