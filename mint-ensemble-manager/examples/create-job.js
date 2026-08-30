const k8s = require("@kubernetes/client-node");

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const batchV1Api = kc.makeApiClient(k8s.BatchV1Api);

const namespace = "wifire-mint";
const jobName = "hello-world";

const jobManifest = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
        name: jobName
    },
    spec: {
        template: {
            spec: {
                containers: [
                    {
                        name: "main",
                        image: "busybox",
                        command: ["echo", "Hello, World!"],
                        resources: {
                            limits: {
                                cpu: "200m", // Limit the CPU usage to 200 millicores
                                memory: "128Mi" // Limit the memory usage to 128 MiB
                            },
                            requests: {
                                cpu: "100m", // Request at least 100 millicores of CPU
                                memory: "64Mi" // Request at least 64 MiB of memory
                            }
                        }
                    }
                ],
                restartPolicy: "Never"
            }
        },
        backoffLimit: 4
    }
};

const main = async () => {
    try {
        const createRes = await batchV1Api.createNamespacedJob(namespace, jobManifest);
        console.log("Job created:", createRes.body.metadata.name);
    } catch (err) {
        console.error("Error creating job:", err);
    }
};

main();
