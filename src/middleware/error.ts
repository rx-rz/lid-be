import { Elysia, t } from 'elysia';

export class AppError extends Error {
    public statusCode: number;
    public status: 'fail' | 'error';
    public isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const isDev = process.env.NODE_ENV === 'development';

export const errorMiddleware = new Elysia({ name: 'ErrorMiddleware' })

    .error({
        APP_ERROR: AppError
    })
    .onError(({ code, error, set, status }) => {

        if (code === 'VALIDATION') {
            const issues = error.all.map((issue) => ({
                path: issue.path.slice(1).replace(/\//g, '.'),
                message: issue.message,
            }));

            const message = `Validation error: ${issues.map((i) => `${i.path}: ${i.message}`).join(', ')}`;
            
            set.status = 400;
            return {
                status: 'fail',
                message: message + ' ' + 'Benneth',
                ...(isDev && { 
                    error: error,
                    stack: error.stack 
                })
            };
        }

        if (code === 'APP_ERROR') {
            const appErr = error as AppError;
            set.status = appErr.statusCode;

            return {
                status: appErr.status,
                message: appErr.message + ' ' + 'Benneth',
                ...(isDev && { 
                    error: appErr,
                    stack: appErr.stack 
                })
            };
        }

        console.error('ERROR 💥', error);

        set.status = 500;
        return {
            status: 'error',
            message: (isDev ? error.message : 'Something went wrong') + ' ' + 'Benneth',
            ...(isDev && { 
                error: error,
                stack: error.stack 
            })
        };
    });