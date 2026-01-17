import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

const s3Enabled = process.env.S3_ENABLED === 'true'

let s3Client: S3Client | null = null

if (s3Enabled) {
  const endpoint = process.env.S3_ENDPOINT
  const port = parseInt(process.env.S3_PORT || '443', 10)
  const useSSL = process.env.S3_USE_SSL === 'true'
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  const region = process.env.S3_REGION || 'us-east-1'

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn('[S3] Configuração incompleta. S3 desabilitado.')
  } else {
    const endpointUrl = useSSL 
      ? `https://${endpoint}${port !== 443 ? `:${port}` : ''}`
      : `http://${endpoint}${port !== 80 ? `:${port}` : ''}`

    s3Client = new S3Client({
      endpoint: endpointUrl,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Necessário para MinIO
    })

    console.log('[S3] Cliente configurado:', endpointUrl)
  }
}

export interface UploadOptions {
  bucket: string
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
}

export async function uploadToS3(options: UploadOptions): Promise<string> {
  if (!s3Enabled || !s3Client) {
    throw new Error('S3 não está habilitado ou configurado')
  }

  const { bucket, key, body, contentType } = options

  // Verificar se o bucket existe, se não existir, criar
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Bucket ${bucket} não existe. Tentando criar...`)
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
        console.log(`[S3] Bucket ${bucket} criado com sucesso`)
      } catch (createError) {
        console.error(`[S3] Erro ao criar bucket ${bucket}:`, createError)
        // Continua mesmo se não conseguir criar (pode já existir ou ter permissões diferentes)
      }
    } else {
      console.error(`[S3] Erro ao verificar bucket ${bucket}:`, error)
      // Continua mesmo assim - pode ser problema de permissão mas o bucket existe
    }
  }

  console.log(`[S3] Fazendo upload: bucket=${bucket}, key=${key}, contentType=${contentType}`)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  try {
    await s3Client.send(command)
    console.log(`[S3] Upload concluído com sucesso: ${key}`)
  } catch (error) {
    console.error(`[S3] Erro ao fazer upload:`, error)
    throw error
  }

  // Retorna URL pública
  const publicUrl = process.env.S3_PUBLIC_URL || `https://${process.env.S3_ENDPOINT}`
  const url = `${publicUrl}/${bucket}/${key}`
  console.log(`[S3] URL pública gerada: ${url}`)
  return url
}

export function getS3PublicUrl(bucket: string, key: string): string {
  const publicUrl = process.env.S3_PUBLIC_URL || `https://${process.env.S3_ENDPOINT}`
  return `${publicUrl}/${bucket}/${key}`
}

export function isS3Enabled(): boolean {
  return s3Enabled && s3Client !== null
}

export { s3Client }

