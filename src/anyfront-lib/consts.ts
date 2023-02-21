export const AWS_S3_SYNC_FILES = 'aws_s3_sync_files'
export const FRONTEND_BUILD = 'frontend_build'
export const GCP_PROJECT_SETUP = 'gcp_project_setup'
export const GCP_PROJECT_SETUP_GET_INFO = 'gcp_project_setup_get_info'
export const GCP_CLOUDRUN_STATIC_HOSTING = 'gcp_cloudrun_static_hosting'
export const AWS_CLOUDFRONT_STATIC_HOSTING = 'aws_cloudfront_static_hosting'
export const STATIC_HOSTING = 'static_hosting'
export const AWS_NEXT_JS = 'aws_next_js'
export const GCP_NEXT_JS = 'gcp_next_js'
export const AWS_SVELTEKIT = 'aws_sveltekit'
export const ANYFRONT = 'anyfront'


const BARBE_SLS_VERSION = 'v0.2.1'
const ANYFRONT_VERSION = 'v0.2.1'

export const TERRAFORM_EXECUTE_URL = `https://hub.barbe.app/barbe-serverless/terraform_execute.js:${BARBE_SLS_VERSION}`
export const AWS_IAM_URL = `https://hub.barbe.app/barbe-serverless/aws_iam.js:${BARBE_SLS_VERSION}`
export const AWS_LAMBDA_URL = `https://hub.barbe.app/barbe-serverless/aws_function.js:${BARBE_SLS_VERSION}`

export const GCP_PROJECT_SETUP_URL = `https://hub.barbe.app/anyfront/gcp_project_setup.js:${ANYFRONT_VERSION}`
export const AWS_S3_SYNC_URL = `https://hub.barbe.app/anyfront/aws_s3_sync_files.js:${ANYFRONT_VERSION}`
export const FRONTEND_BUILD_URL = `https://hub.barbe.app/anyfront/frontend_build.js:${ANYFRONT_VERSION}`
export const GCP_CLOUDRUN_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/gcp_cloudrun_static_hosting.js:${ANYFRONT_VERSION}`
export const AWS_NEXT_JS_URL = `https://hub.barbe.app/anyfront/aws_next_js.js:${ANYFRONT_VERSION}`
export const GCP_NEXT_JS_URL = `https://hub.barbe.app/anyfront/gcp_next_js.js:${ANYFRONT_VERSION}`
export const AWS_CLOUDFRONT_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting.js:${ANYFRONT_VERSION}`
export const STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/static_hosting.js:${ANYFRONT_VERSION}`