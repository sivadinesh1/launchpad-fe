import { Injectable } from '@angular/core';
import {
    Resolve,
    ActivatedRouteSnapshot,
    RouterStateSnapshot,
    Router,
} from '@angular/router';
import { CommonApiService } from './common-api.service';

@Injectable({
    providedIn: 'root',
})
export class CustomerBalanceReportsResolverService implements Resolve<any> {
    maxDate = new Date();
    minDate = new Date();
    from_date = new Date();
    to_date = new Date();

    constructor(
        private commonApiService: CommonApiService,
        private router: Router
    ) {
        const dateOffset = 24 * 60 * 60 * 1000 * 14;
        this.from_date.setTime(this.minDate.getTime() - dateOffset);
    }

    resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        return this.commonApiService.getCustomerBalanceReports({
            customer_id: 'all',
            asOn: 'today',
            invoice_type: 'gstInvoice',
            order: 'desc',
        });
    }
}