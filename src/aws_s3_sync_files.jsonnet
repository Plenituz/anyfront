local barbe = std.extVar("barbe");
local env = std.extVar("env");
local container = std.extVar("container");
local globalDefaults = barbe.compileDefaults(container, "");

barbe.pipelines([{
    apply: [
        function(container) barbe.databags([
            {
                Name: "aws_s3_sync_credentials",
                Type: "aws_credentials_request",
                Value: {}
            },
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_s3_sync_files", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local awsCredentials =
                    if std.get(std.get(container, "aws_credentials", {}), "aws_s3_sync_credentials", null) != null then
                        barbe.asVal(container.aws_credentials.aws_s3_sync_credentials[0].Value)
                    else
                        {
                            access_key_id: "",
                            secret_access_key: "",
                            session_token: "",
                        }
                ;
                {
                    Type: "buildkit_run_in_container",
                    Name: "aws_s3_sync_" + bag.Name,
                    Value: {
                        no_cache: true,
                        display_name: std.get(fullBlock, "display_name", null),
                        dockerfile: |||
                            FROM amazon/aws-cli:%(aws_cli_version)s

                            ENV AWS_ACCESS_KEY_ID="%(access_key_id)s"
                            ENV AWS_SECRET_ACCESS_KEY="%(secret_access_key)s"
                            ENV AWS_SESSION_TOKEN="%(session_token)s"
                            ENV AWS_REGION="%(aws_region)s"
                            ENV AWS_PAGER=""

                            COPY --from=src ./%(dir)s /src
                            WORKDIR /src

                            RUN aws s3 sync %(blob)s s3://%(bucket_name)s%(delete)s
                        ||| % {


                            //TODO version selection
                            aws_cli_version: "latest",
                            dir: barbe.asStr(std.get(fullBlock, "dir", "")),
                            bucket_name: barbe.asStr(fullBlock.bucket_name),
                            delete: if barbe.asVal(std.get(fullBlock, "delete", barbe.asSyntax(false))) then " --delete" else "",
                            blob: barbe.asStr(std.get(fullBlock, "blob", ".")),

                            access_key_id: barbe.asStr(awsCredentials.access_key_id),
                            secret_access_key: barbe.asStr(awsCredentials.secret_access_key),
                            session_token: barbe.asStr(awsCredentials.session_token),
                            aws_region: std.get(env, "AWS_REGION", "us-east-1"),
                        },
                    }
                }
            )
        ])
    ]

}])