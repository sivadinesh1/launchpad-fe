import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError, map } from 'rxjs/operators';
import { CommonApiService } from './common-api.service';
import { LoadingService } from './loading.service';
import { AuthenticationService } from './authentication.service';
import { ErrorService } from '../services/error.service';

import { Injectable } from '@angular/core';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    request = request.clone({
      withCredentials: true,
    });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const errorMessage = this.setError(error);
        return throwError(() => errorMessage);
      })
    );
  }

  setError(error: HttpErrorResponse): string {
    let errorMessage = 'Unknown error occured';
    if (error.error instanceof ErrorEvent) {
      // Client side error
      errorMessage = error.error.message;
    } else {
      // server side error
      if (error.status !== 0) {
        errorMessage = error.error.message;
      }
      if (error.status === 400) {
        console.log('this should print your error!', error.error);
      }
      if (error.status === 401) {
        console.log('this should print your error!', error.error);
      }

      if (
        error.status === 500 &&
        error.error.message.startsWith('connect ECONNREFUSED')
      ) {
        console.log('database connection error');
      }
    }
    return errorMessage;
  }
}

// export class HttpErrorInterceptor implements HttpInterceptor {
//   token: any;
//   username: any;

//   constructor(
//     private commonapiservice: CommonApiService,
//     private _errorservice: ErrorService,
//     private _loadingservice: LoadingService,
//     private _authservice: AuthenticationService
//   ) {}

//   intercept(
//     request: HttpRequest<any>,
//     next: HttpHandler
//   ): Observable<HttpEvent<any>> {
//     const currentUser = this._authservice.currentUserValue;

//     //  this.token = this._authservice.token;
//     this.username = currentUser.username;

//     if (this.username && this.token) {
//       request = request.clone({
//         setHeaders: {
//           Authorization: this.token,
//         },
//       });
//     }

//     return next.handle(request).pipe(
//       retry(1),
//       map((event: HttpEvent<any>) => {
//         if (event instanceof HttpResponse) {
//           console.log('event--->>>', event);
//         }

//         return event;
//       }),
//       catchError((error: HttpErrorResponse) => {
//         let errorMessage = '';
//         if (error.error instanceof ErrorEvent) {
//           // client-side error
//           errorMessage = `Error: ${error.error.message}`;
//         } else {
//           // server-side error
//           errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
//         }
//         this._loadingservice.dismiss();

//         if (request.url.indexOf('capture-error') === -1) {
//           this._errorservice.logErrortoService(`errorMessage`, error);
//           this._loadingservice.presentToastWithOptions(
//             this._authservice.errormsg,
//             'middle',
//             false,
//             ''
//           );
//         }

//         return throwError(() => errorMessage);
//       })
//     );
//   }
// }
