import {
    authentication,
    dynamicHeaders,
    errorHandling,
    pre_authentication,
    redirect,
    setupDependencies
} from '@shared/middleware';

export const onRequest = [
    redirect, // Redirect to Vulnetix homepage
    errorHandling, // Handle errors and log them
    pre_authentication, // Check signatures for requests before connecting to the Database
    setupDependencies, // Setup Prisma ORM and ensure JSON body is available
    authentication, // Authenticate requests
    dynamicHeaders // Set CORS headers for all /api responses
]
