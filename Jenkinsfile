
pipeline {
    agent {
        label 'docker-agent'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        PATH = "/opt/homebrew/bin:${env.PATH}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                sh '''
                    set -eu
                    node --version
                    npm --version
                    docker --version
                    /opt/homebrew/bin/trivy --version
                '''
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
        
        stage('Publish Artifact to Nexus') {
    when {
        expression {
            env.GIT_BRANCH == 'origin/main' ||
            env.GIT_BRANCH == 'main' ||
            env.BRANCH_NAME == 'main'
        }
    }

    steps {
        withCredentials([
            usernamePassword(
                credentialsId: 'nexus-credentials',
                usernameVariable: 'NEXUS_USER',
                passwordVariable: 'NEXUS_PASSWORD'
            )
        ]) {
            sh '''
                set +x
                set -eu

                VERSION="1.0.${BUILD_NUMBER}"
                ARTIFACT="cnam-dashboard-${VERSION}.tar.gz"

                tar -czf "$ARTIFACT" -C dist .

                curl --fail --show-error --silent \
                    --retry 3 \
                    -u "$NEXUS_USER:$NEXUS_PASSWORD" \
                    --upload-file "$ARTIFACT" \
                    "http://localhost:8082/repository/cnam-releases/cnam-dashboard/${VERSION}/${ARTIFACT}"

                echo "Artefact CNAM publie dans Nexus : $ARTIFACT"
            '''
        }
    }
}

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'

                    withSonarQubeEnv('SonarQube-CNAM') {

                        sh '''
                            set +x
                            set -eu

                            echo "Verification de SonarQube..."

                            if [ -z "${SONAR_AUTH_TOKEN:-}" ]; then
                                echo "ERREUR : SONAR_AUTH_TOKEN absent"
                                exit 1
                            fi

                            HTTP_CODE=$(curl -sS \
                                --connect-timeout 10 \
                                --max-time 30 \
                                -o /dev/null \
                                -w "%{http_code}" \
                                -u "$SONAR_AUTH_TOKEN:" \
                                "http://localhost:9000/api/v2/analysis/version")

                            echo "Authentification SonarQube : HTTP $HTTP_CODE"

                            if [ "$HTTP_CODE" != "200" ]; then
                                echo "ERREUR : SonarQube indisponible ou authentification refusee"
                                exit 1
                            fi

                            echo "Authentification SonarQube OK"
                        '''

                        withEnv(["SCANNER_HOME=${scannerHome}"]) {
                            sh '''
                                set +x
                                set -eu

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
                    string(
                        credentialsId: 'cnam-supabase-url',
                        variable: 'VITE_SUPABASE_URL'
                    ),
                    string(
                        credentialsId: 'cnam-supabase-publishable-key',
                        variable: 'VITE_SUPABASE_PUBLISHABLE_KEY'
                    )
                ]) {
                    script {
                        def isMain = (
                            env.GIT_BRANCH == 'origin/main' ||
                            env.GIT_BRANCH == 'main' ||
                            env.BRANCH_NAME == 'main'
                        )

                        def imageTag = isMain ? 'main' : 'dev'

                        withEnv(["DOCKER_IMAGE_TAG=${imageTag}"]) {
                            sh '''
                                set +x
                                set -eu

                                if [ -z "${VITE_SUPABASE_URL:-}" ] || \
                                   [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
                                    echo "ERREUR : variables Supabase manquantes"
                                    exit 1
                                fi

                                echo "Construction de l'image Docker..."

                                docker build \
                                    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
                                    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
                                    -t "cnam-dashboard:$DOCKER_IMAGE_TAG" .

                                echo "Image Docker construite"
                            '''
                        }
                    }
                }
            }
        }

        stage('Security Scan - Trivy') {
            steps {
                script {
                    def isMain = (
                        env.GIT_BRANCH == 'origin/main' ||
                        env.GIT_BRANCH == 'main' ||
                        env.BRANCH_NAME == 'main'
                    )

                    def imageTag = isMain ? 'main' : 'dev'

                    withEnv(["DOCKER_IMAGE_TAG=${imageTag}"]) {
                        sh '''
                            set -eu

                            echo "Analyse de securite Trivy..."

                            /opt/homebrew/bin/trivy image \
                                --severity HIGH,CRITICAL \
                                --exit-code 1 \
                                "cnam-dashboard:$DOCKER_IMAGE_TAG"

                            echo "Analyse Trivy reussie"
                        '''
                    }
                }
            }
        }

        stage('Deploy Docker') {
            when {
                expression {
                    env.GIT_BRANCH == 'origin/main' ||
                    env.GIT_BRANCH == 'main' ||
                    env.BRANCH_NAME == 'main'
                }
            }

            steps {
                sh '''
                    set -eu

                    echo "Deploiement Docker..."

                    docker rm -f cnam-dashboard-app 2>/dev/null || true

                    docker run -d \
                        --name cnam-dashboard-app \
                        -p 3000:80 \
                        --restart unless-stopped \
                        cnam-dashboard:main

                    echo "Verification HTTP Docker..."

                    for i in 1 2 3 4 5; do
                        if curl -fsS \
                            --max-time 5 \
                            http://localhost:3000/ \
                            -o /dev/null; then
                            echo "Application Docker accessible"
                            exit 0
                        fi

                        sleep 3
                    done

                    echo "ERREUR : application Docker inaccessible"
                    exit 1
                '''
            }
        }

        stage('Deploy Kubernetes') {
            when {
                expression {
                    env.GIT_BRANCH == 'origin/main' ||
                    env.GIT_BRANCH == 'main' ||
                    env.BRANCH_NAME == 'main'
                }
            }

            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    sh '''
                        set -eu

                        IMAGE="cnam-dashboard:main-${BUILD_NUMBER}"

                        echo "=== Verification Minikube ==="

                        /opt/homebrew/bin/minikube status

                        echo "=== Preparation de l'image versionnee ==="

                        docker tag cnam-dashboard:main "$IMAGE"

                        echo "=== Chargement de l'image dans Minikube ==="

                        /opt/homebrew/bin/minikube image load "$IMAGE"

                        echo "=== Application des manifestes Kubernetes ==="

                        /opt/homebrew/bin/kubectl apply \
                            -f k8s/deployment.yaml

                        /opt/homebrew/bin/kubectl apply \
                            -f k8s/service.yaml

                        echo "=== Mise a jour de l'image Kubernetes ==="

                        /opt/homebrew/bin/kubectl set image \
                            deployment/cnam-dashboard \
                            cnam-dashboard="$IMAGE"

                        echo "=== Verification du rollout ==="

                        /opt/homebrew/bin/kubectl rollout status \
                            deployment/cnam-dashboard \
                            --timeout=180s

                        echo "=== Verification des Pods ==="

                        /opt/homebrew/bin/kubectl get pods \
                            -l app=cnam-dashboard

                        echo "=== Verification du Deployment ==="

                        /opt/homebrew/bin/kubectl get deployment \
                            cnam-dashboard

                        echo "=== Verification du Service ==="

                        /opt/homebrew/bin/kubectl get service \
                            cnam-dashboard

                        echo "Deploiement Kubernetes termine"
                    '''
                }
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
