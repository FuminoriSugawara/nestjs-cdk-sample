import { LoggerModule } from 'nestjs-pino';
import { DynamicModule } from '@nestjs/common';
import { IncomingMessage } from 'http';

export class CustomLoggerModule {
  static forRoot(): DynamicModule {
    let transportTarget;
    if (process.env.NODE_ENV !== 'production') {
      transportTarget = {
        target: 'pino-pretty',
        options: {
          singleLine: true,
        },
      };
    }
    const params = {
      pinoHttp: {
        autoLogging: {
          ignore: (req: IncomingMessage) => {
            return req.url === '/health';
          },
        },
        transport: transportTarget,
      },
    };
    return LoggerModule.forRoot(params);
  }
}
