import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export const BUCKET = process.env.S3_BUCKET || "demo-cloud-763749302763-eu-west-3-an";
const REGION = process.env.AWS_DEFAULT_REGION || "eu-west-3";

// Les credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) sont lus
// automatiquement depuis les variables d'environnement par le SDK.
export const s3 = new S3Client({ region: REGION });

export async function listFiles() {
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  return (out.Contents || []).map((o) => ({
    name: o.Key,
    size: o.Size,
    last_modified: o.LastModified,
  }));
}

export async function getFileText(name) {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: name }));
  return await out.Body.transformToString();
}

export async function getFileBytes(name) {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: name }));
  return Buffer.from(await out.Body.transformToByteArray());
}

export async function putFileText(name, content) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: name, Body: content }));
}

export async function putFileBytes(name, buffer) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: name, Body: buffer }));
}
