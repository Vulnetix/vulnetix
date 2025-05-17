import { Context } from "@shared/interfaces";

const artifacts = [
    'cyclonedx', 'spdx', 'vex' , 'vdr', 'sarif', 'cvelistv5'
]

export async function onRequestGet(context: Context) {
    const { env, request, next } = context
    const url = new URL(request.url)
    console.log(url.pathname.slice(1))
    if (
        artifacts.some(artifact => url.pathname.startsWith(`/${artifact}/`))
    ) {
        const file = await env.r2artifacts.get(url.pathname.slice(1))
        if (!file) {
            return new Response(null, { status: 404 })
        }
        return new Response(file.body, {
            headers: { "Content-Type": file.httpMetadata.contentType },
        })        
    }

    return next()
}
