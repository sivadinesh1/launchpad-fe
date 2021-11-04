import {
    Component,
    OnInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
} from '@angular/core';
import { CommonApiService } from '../../services/common-api.service';
import { AuthenticationService } from '../../services/authentication.service';

import {
    FormGroup,
    FormControl,
    Validators,
    FormBuilder,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, lastValueFrom } from 'rxjs';
import { Purchase } from '../../models/Purchase';
import { Vendor } from 'src/app/models/Vendor';
import { AlertController } from '@ionic/angular';

import { filter, map, startWith } from 'rxjs/operators';
import { User } from 'src/app/models/User';
import { PurchaseEntryDialogComponent } from '../../components/purchase/purchase-entry-dialog/purchase-entry-dialog.component';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import * as xlsx from 'xlsx';
import * as moment from 'moment';

@Component({
    selector: 'app-search-purchase-order',
    templateUrl: './search-purchase-order.page.html',
    styleUrls: ['./search-purchase-order.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPurchaseOrderPage implements OnInit {
    purchases$: Observable<Purchase[]>;
    vendor$: Observable<Vendor[]>;

    resultList: any;
    vendorList: any;

    statusFlag = 'D';
    selectedVend = 'all';
    arr: Array<any>;

    today = new Date();
    submitForm: FormGroup;
    maxDate = new Date();
    minDate = new Date();
    dobMaxDate = new Date();

    orderDefaultFlag = 'desc';
    orderList = [
        { id: 'desc', value: 'Recent Orders First' },
        { id: 'asc', value: 'Old Orders First' },
    ];

    statusList = [
        { id: 'all', value: 'All' },
        { id: 'D', value: 'Draft' },
        { id: 'C', value: 'Completed' },
    ];

    from_date = new Date();
    to_date = new Date();

    sumTotalValue = 0.0;
    sumNumItems = 0;
    // uniqCustCount = 0;

    purchase$: Observable<Purchase[]>;

    draftPurchase$: Observable<Purchase[]>;
    fullfilledPurchase$: Observable<Purchase[]>;

    filteredPurchase$: Observable<Purchase[]>;
    user_data$: Observable<User>;
    user_data: any;

    filteredValues: any;
    tabIndex = 0;

    filteredVendor: Observable<any[]>;
    vendor_lis: Vendor[];

    constructor(
        private _cdr: ChangeDetectorRef,
        private _commonApiService: CommonApiService,
        private _fb: FormBuilder,
        private _router: Router,
        private _route: ActivatedRoute,
        public alertController: AlertController,
        private _dialog: MatDialog,
        private _authService: AuthenticationService
    ) {
        const dateOffset = 24 * 60 * 60 * 1000 * 10;
        this.from_date.setTime(this.minDate.getTime() - dateOffset);

        this.submitForm = this._fb.group({
            vendor_id: ['all'],
            vendor_ctrl: ['All Vendors'],
            to_date: [this.to_date, Validators.required],
            from_date: [this.from_date, Validators.required],
            status: new FormControl('all'),
            order: ['desc'],
        });

        this.user_data$ = this._authService.currentUser;

        this.user_data$
            .pipe(filter((data) => data !== null))
            .subscribe((data: any) => {
                this.user_data = data;
                this.init();
                this._cdr.markForCheck();
            });

        this._route.params.subscribe((params) => {
            if (this.user_data !== undefined) {
                this.init();
            }
        });
    }

    ngOnInit() {}

    async init() {
        this._commonApiService.getAllActiveVendors().subscribe((data: any) => {
            this.vendor_lis = data;

            this.filteredVendor =
                this.submitForm.controls.vendor_ctrl.valueChanges.pipe(
                    startWith(''),
                    map((vendor) =>
                        vendor
                            ? this.filterVendor(vendor)
                            : this.vendor_lis.slice()
                    )
                );

            this.search();
            this._cdr.markForCheck();
        });
    }

    filterVendor(value: any) {
        if (typeof value == 'object') {
            return this.vendor_lis.filter(
                (vendor) =>
                    vendor.vendor_name
                        .toLowerCase()
                        .indexOf(value.name.toLowerCase()) === 0
            );
        } else if (typeof value == 'string') {
            return this.vendor_lis.filter(
                (vendor) =>
                    vendor.vendor_name
                        .toLowerCase()
                        .indexOf(value.toLowerCase()) === 0
            );
        }
    }

    getPosts(event) {
        this.submitForm.patchValue({
            vendor_id: event.option.value.id,
            vendor_ctrl: event.option.value.name,
        });

        this.tabIndex = 0;
        this.search();
        this._cdr.markForCheck();
    }

    async presentAlert(msg: string) {
        const alert = await this.alertController.create({
            header: 'Alert',

            message: msg,
            buttons: ['OK'],
        });

        await alert.present();
    }

    clearInput() {
        this.submitForm.patchValue({
            vendor_id: 'all',
            vendor_ctrl: '',
        });
        this._cdr.markForCheck();
    }

    async search() {
        this.purchases$ = this._commonApiService.searchPurchases({
            center_id: this.user_data.center_id,
            vendor_id: this.submitForm.value.vendor_id,
            status: this.submitForm.value.status,
            from_date: this.submitForm.value.from_date,
            to_date: this.submitForm.value.to_date,
            order: this.submitForm.value.order,
        });

        this.filteredPurchase$ = this.purchases$;

        const value = await lastValueFrom(this.filteredPurchase$);
        this.filteredValues = value.filter((data: any) => data.status === 'C');

        // to calculate the count on each status
        this.draftPurchase$ = this.purchases$.pipe(
            map((arr: any) => arr.filter((f) => f.status === 'D'))
        );
        this.fullfilledPurchase$ = this.purchases$.pipe(
            map((arr: any) => arr.filter((f) => f.status === 'C'))
        );
        this.calculateSumTotals();
        this.tabIndex = 0;
        this._cdr.markForCheck();
    }

    goPurchaseEditScreen(item) {
        this._router.navigateByUrl(`/home/purchase-order/edit/${item.id}`);
    }

    goPurchaseAddScreen() {
        this._router.navigateByUrl(`/home/purchase-order/edit/0`);
    }

    statusChange($event) {
        this.statusChange = $event.source.value;
    }

    selectedVendor($event) {
        this.selectedVend = $event.source.value;
    }

    to_dateSelected($event) {
        this.to_date = $event.target.value;
    }

    from_dateSelected($event) {
        this.from_date = $event.target.value;
    }

    delete(item) {
        this._commonApiService
            .deletePurchaseData(item.id)
            .subscribe((data: any) => {
                if (data.result === 'success') {
                    this._commonApiService
                        .deletePurchaseMaster(item.id)
                        .subscribe((data1: any) => {
                            if (data1.result === 'success') {
                                this.presentAlert('Draft Purchase Deleted!');
                            }

                            this.init();
                        });
                }
            });
    }

    async presentAlertConfirm(item) {
        const alert = await this.alertController.create({
            header: 'Confirm!',
            message: 'Are you sure to Delete?',
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel',
                    cssClass: 'secondary',
                    handler: (blah) => {
                        console.log('Confirm Cancel: blah');
                    },
                },
                {
                    text: 'Okay',
                    handler: () => {
                        console.log('Confirm Okay');
                        this.delete(item);
                    },
                },
            ],
        });

        await alert.present();
    }

    async tabClick($event) {
        const value = await lastValueFrom(this.filteredPurchase$);

        if ($event.index === 0) {
            this.filteredValues = value.filter(
                (data: any) => data.status === 'D' || data.status === 'C'
            );
        }

        // DnD
        // if ($event.index === 0) {
        // 	this.filteredValues = value.filter((data: any) => data.status === 'D');
        // } else if ($event.index === 1) {
        // 	this.filteredValues = value.filter((data: any) => data.status === 'C');
        // }

        this.calculateSumTotals();
        this._cdr.markForCheck();
    }

    calculateSumTotals() {
        this.sumTotalValue = 0.0;
        this.sumNumItems = 0;

        this.sumTotalValue = this.filteredValues
            .map((item) => item.net_total)
            .reduce(
                (accumulator, currentValue) => accumulator + currentValue,
                0
            )
            .toFixed(2);

        this.sumNumItems = this.filteredValues
            .map((item) => item.no_of_items)
            .reduce(
                (accumulator, currentValue) => accumulator + currentValue,
                0
            );

        // DnD - How to count string result set (count of unique vendor names)
        // this.uniqCustCount = this.filteredValues.map(item => {
        //   return item.vendor_name;
        // }).filter(function (val, i, arr) {
        //   return arr.indexOf(val) === i;
        // }).length;
    }

    openDialog(row): void {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.width = '50%';
        dialogConfig.height = '100%';
        dialogConfig.data = row;
        dialogConfig.position = { top: '0', right: '0' };

        const dialogRef = this._dialog.open(
            PurchaseEntryDialogComponent,
            dialogConfig
        );

        dialogRef.afterClosed().subscribe((result) => {
            console.log('The dialog was closed');
        });
    }

    async exportDraftPurchaseToExcel() {
        this.arr = [];
        const fileName = 'Draft_Purchase_Reports.xlsx';

        this.arr = await lastValueFrom(this.draftPurchase$);

        const reportData = JSON.parse(JSON.stringify(this.arr));

        reportData.forEach((e) => {
            e['Vendor Name'] = e.vendor_name;
            delete e.vendor_name;

            e['Invoice #'] = e.invoice_no;
            delete e.invoice_no;

            e['Invoice Date'] = e.invoice_date;
            delete e.invoice_date;

            e['Purchase Type'] = e.purchase_type;
            delete e.purchase_type;

            e['Total Qty'] = e.total_qty;
            delete e.total_qty;

            e['# of Items'] = e.no_of_items;
            delete e.no_of_items;

            e['Taxable Value'] = e.after_tax_value;
            delete e.after_tax_value;

            e.CGST = e.cgst;
            delete e.cgst;

            e.SGST = e.sgst;
            delete e.sgst;

            e.IGST = e.igst;
            delete e.igst;

            e['Total Value'] = e.total_value;
            delete e.total_value;

            e['Net Total'] = e.net_total;
            delete e.net_total;

            e['Stock Inwards Date Time'] = e.stock_inwards_datetime;
            delete e.stock_inwards_datetime;

            delete e.id;
            delete e.center_id;
            delete e.vendor_id;
            delete e.lr_no;
            delete e.lr_date;
            delete e.received_date;
            delete e.order_no;
            delete e.order_date;
            delete e.transport_charges;

            delete e.unloading_charges;
            delete e.misc_charges;
            delete e.status;
            delete e.revision;
            delete e.tax_applicable;
            delete e.roundoff;
            delete e.retail_customer_name;
            delete e.no_of_boxes;
        });

        const ws1: xlsx.WorkSheet = xlsx.utils.json_to_sheet([]);
        const wb1: xlsx.WorkBook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb1, ws1, 'sheet1');

        //then add ur Title txt
        xlsx.utils.sheet_add_json(
            wb1.Sheets.sheet1,
            [
                {
                    header: 'Draft Purchase Reports',
                    from_date: `From: ${moment(
                        this.submitForm.value.from_date
                    ).format('DD/MM/YYYY')}`,
                    to_date: `To: ${moment(
                        this.submitForm.value.to_date
                    ).format('DD/MM/YYYY')}`,
                },
            ],
            {
                skipHeader: true,
                origin: 'A1',
            }
        );

        //start frm A2 here
        xlsx.utils.sheet_add_json(wb1.Sheets.sheet1, reportData, {
            skipHeader: false,
            origin: 'A2',
        });

        xlsx.writeFile(wb1, fileName);
    }

    async exportCompletedPurchaseToExcel() {
        this.arr = [];
        const fileName = 'Completed_Purchase_Reports.xlsx';

        this.arr = await lastValueFrom(this.fullfilledPurchase$);

        const reportData = JSON.parse(JSON.stringify(this.arr));

        reportData.forEach((e) => {
            e['Vendor Name'] = e.vendor_name;
            delete e.vendor_name;

            e['Invoice #'] = e.invoice_no;
            delete e.invoice_no;

            e['Invoice Date'] = e.invoice_date;
            delete e.invoice_date;

            e['Purchase Type'] = e.purchase_type;
            delete e.purchase_type;

            e['Total Qty'] = e.total_qty;
            delete e.total_qty;

            e['# of Items'] = e.no_of_items;
            delete e.no_of_items;

            e['Taxable Value'] = e.after_tax_value;
            delete e.after_tax_value;

            e.CGST = e.cgst;
            delete e.cgst;

            e.SGST = e.sgst;
            delete e.sgst;

            e.IGST = e.igst;
            delete e.igst;

            e['Total Value'] = e.total_value;
            delete e.total_value;

            e['Net Total'] = e.net_total;
            delete e.net_total;

            e['Stock Inwards Date Time'] = e.stock_inwards_datetime;
            delete e.stock_inwards_datetime;

            delete e.id;
            delete e.center_id;
            delete e.vendor_id;
            delete e.lr_no;
            delete e.lr_date;
            delete e.received_date;
            delete e.order_no;
            delete e.order_date;
            delete e.transport_charges;

            delete e.unloading_charges;
            delete e.misc_charges;
            delete e.status;
            delete e.revision;
            delete e.tax_applicable;
            delete e.roundoff;
            delete e.retail_customer_name;
            delete e.no_of_boxes;
        });

        const ws1: xlsx.WorkSheet = xlsx.utils.json_to_sheet([]);
        const wb1: xlsx.WorkBook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb1, ws1, 'sheet1');

        //then add ur Title txt
        xlsx.utils.sheet_add_json(
            wb1.Sheets.sheet1,
            [
                {
                    header: 'Completed Purchase Reports',
                    from_date: `From: ${moment(
                        this.submitForm.value.from_date
                    ).format('DD/MM/YYYY')}`,
                    to_date: `To: ${moment(
                        this.submitForm.value.to_date
                    ).format('DD/MM/YYYY')}`,
                },
            ],
            {
                skipHeader: true,
                origin: 'A1',
            }
        );

        //start frm A2 here
        xlsx.utils.sheet_add_json(wb1.Sheets.sheet1, reportData, {
            skipHeader: false,
            origin: 'A2',
        });

        xlsx.writeFile(wb1, fileName);
    }
}