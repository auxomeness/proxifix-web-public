import { spawn } from 'node:child_process'

const baseUrl = process.env.BASE_URL ?? 'https://proxifix-api.karlaustinpavia17.workers.dev'

const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env
      }
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })

const main = async () => {
  console.log(`Running post-deploy smoke checks against ${baseUrl}`)

  await run('node', ['scripts/regression-live.mjs'], {
    BASE_URL: baseUrl
  })

  await run('node', ['scripts/check-message-ui-path.mjs'], {
    BASE_URL: baseUrl
  })

  console.log('PASS post-deploy smoke checks')
}

main().catch((error) => {
  console.error('FAIL post-deploy smoke checks')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
