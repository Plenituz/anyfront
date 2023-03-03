import { asStr, asVal, Databag, exportDatabags, iterateBlocks, readDatabagContainer, SugarCoatedDatabag } from '../../barbe-serverless/src/barbe-std/utils';
import { AWS_S3_SYNC_FILES } from './anyfront-lib/consts';
import { getAwsCreds, applyDefaults } from '../../barbe-serverless/src/barbe-sls-lib/lib';

const container = readDatabagContainer()

function awsS3SyncFilesIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }
    const [block, _] = applyDefaults(container, bag.Value)
    const awsCreds = getAwsCreds();
    if(!awsCreds) {
        throw new Error('couldn\'t find AWS credentials')
    }
    const deleteArg = block.delete && asVal(block.delete) ? ' --delete' : ''
    const cacheControl = block.cache_control ? ` --cache-control "${asStr(block.cache_control)}"` : ''

    return [{
        Type: 'buildkit_run_in_container',
        Name: `aws_s3_sync_${bag.Name}`,
        Value: {
            no_cache: true,
            display_name: block.display_name,
            dockerfile: `
                FROM amazon/aws-cli:latest

                ENV AWS_ACCESS_KEY_ID="${awsCreds.access_key_id}"
                ENV AWS_SECRET_ACCESS_KEY="${awsCreds.secret_access_key}"
                ENV AWS_SESSION_TOKEN="${awsCreds.session_token}"
                ENV AWS_REGION="${os.getenv("AWS_REGION") || 'us-east-1'}"
                ENV AWS_PAGER=""

                COPY --from=src ./${asStr(block.dir || '')} /src
                WORKDIR /src

                RUN aws s3 sync ${asStr(block.blob || '.')} s3://${asStr(block.bucket_name || '')}${deleteArg}${cacheControl}`
        }
    }]
}

exportDatabags(iterateBlocks(container, AWS_S3_SYNC_FILES, awsS3SyncFilesIterator).flat())
