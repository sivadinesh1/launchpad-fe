import {
    Component,
    OnInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    ViewChild,
    ElementRef,
    QueryList,
    ViewChildren,
    AfterViewInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonApiService } from 'src/app/services/common-api.service';
import { CurrencyPadComponent } from 'src/app/components/currency-pad/currency-pad.component';

import { MatDialog, MatDialogConfig } from '@angular/material/dialog';

import { ModalController, AlertController, IonSearchbar } from '@ionic/angular';

import { AuthenticationService } from 'src/app/services/authentication.service';
import { InvoiceSuccessComponent } from 'src/app/components/invoice-success/invoice-success.component';
import { AddMoreEnquiryComponent } from 'src/app/components/add-more-enquiry/add-more-enquiry.component';
import {
    filter,
    tap,
    catchError,
    debounceTime,
    switchMap,
} from 'rxjs/operators';
import * as xlsx from 'xlsx';
import { NgxSpinnerService } from 'ngx-spinner';

import { MatSort } from '@angular/material/sort';
import { Observable, empty, of, EMPTY } from 'rxjs';
import {
    NgForm,
    FormGroup,
    Validators,
    FormBuilder,
    FormArray,
} from '@angular/forms';
import { Customer } from 'src/app/models/Customer';
import { CustomerAddDialogComponent } from 'src/app/components/customers/customer-add-dialog/customer-add-dialog.component';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { CustomerViewDialogComponent } from 'src/app/components/customers/customer-view-dialog/customer-view-dialog.component';
import { RequireMatch } from 'src/app/util/directives/requireMatch';
import { User } from 'src/app/models/User';
import { SuccessMessageDialogComponent } from './../../components/success-message-dialog/success-message-dialog.component';
import { IProduct } from 'src/app/models/Product';
import { ProductAddDialogComponent } from './../../components/products/product-add-dialog/product-add-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IonContent } from '@ionic/angular';

@Component({
    selector: 'app-process-enquiry',
    templateUrl: './process-enquiry.page.html',
    styleUrls: ['./process-enquiry.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessEnquiryPage implements OnInit, AfterViewInit {
    @ViewChild('myForm1', { static: true }) myForm1: NgForm;

    // TAB navigation for customer list
    @ViewChild('typeHead1', { read: MatAutocompleteTrigger })
    autoTrigger1: MatAutocompleteTrigger;

    @ViewChildren('typeHead', { read: MatAutocompleteTrigger })
    autoTriggerList: QueryList<MatAutocompleteTrigger>;

    @ViewChildren('typeHead2', { read: MatAutocompleteTrigger })
    autoTrigger2: QueryList<MatAutocompleteTrigger>;

    @ViewChild('qty', { static: true }) qty: any;
    @ViewChild(IonContent, { static: false }) content: IonContent;
    @ViewChild('plist', { static: true }) plist: any;
    submitForm: FormGroup;
    submitForm1: FormGroup;

    enqDetailsOrig: any = [];
    selectedEnq: any;

    pageLength: any;

    customer_lis: Customer[];

    enq_id: any;
    selected_description = '';
    selected_mrp = '';
    lineItemData: any;

    status: any;
    isTableHasData = true;

    isLoading = false;
    isCLoading = false;
    customer_name: any;
    customer_data: any;

    searchText = '';

    showDelIcon = false;

    is_customer_selected = false;
    productList$: Observable<any>[] = [];

    product_lis: IProduct[];

    user_data$: Observable<User>;
    user_data: any;
    ready = 0;

    clicked = false;
    removeRowArr = [];
    deletedRowArr = [];

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private dialog: MatDialog,

        private _authService: AuthenticationService,
        public alertController: AlertController,
        private _commonApiService: CommonApiService,
        private _dialog: MatDialog,
        private _fb: FormBuilder,
        private _fb1: FormBuilder,
        private spinner: NgxSpinnerService,
        private _cdr: ChangeDetectorRef,
        private _snackBar: MatSnackBar
    ) {
        this.init();
        this.user_data$ = this._authService.currentUser;
        this.user_data$
            .pipe(filter((data) => data !== null))
            .subscribe((data: any) => {
                this.user_data = data;
                this.ready = 1;

                this._route.params.subscribe((params) => {
                    this.clicked = false;
                    this.enq_id = params.enq_id;

                    this.submitForm1.patchValue({
                        enquiry_id: params.enq_id,
                        center_id: this.user_data.center_id,
                        created_by: this.user_data.user_id,
                    });

                    this.submitForm.patchValue({
                        created_by: this.user_data.user_id,
                    });

                    this.enqDetailsOrig = [];
                    this.reloadEnqDetails('');
                    this._cdr.markForCheck();
                });

                this._cdr.markForCheck();
            });
    }

    get enquiries(): FormArray {
        return this.submitForm.get('enquiries') as FormArray;
    }

    ngOnInit() {
        this.spinner.show();
    }

    init() {
        this.submitForm = this._fb.group({
            customer_ctrl: [null, [Validators.required, RequireMatch]],
            enquiries: this._fb.array([]),
            created_by: [],
        });

        this.submitForm1 = this._fb1.group({
            enquiry_id: ['', Validators.required],

            center_id: [''],
            product_ctrl: [null, [Validators.required, RequireMatch]],
            remarks: [''],

            temp_desc: [''],

            temp_quantity: [
                '1',
                [
                    Validators.required,
                    Validators.max(1000),
                    Validators.min(1),
                    Validators.pattern(/\-?\d*\.?\d{1,2}/),
                ],
            ],
            created_by: [],
        });

        this.searchProducts();
        this.searchCustomers();
    }

    ngAfterViewInit() {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.autoTrigger1 &&
            this.autoTrigger1.panelClosingActions.subscribe((x) => {
                if (this.autoTrigger1.activeOption) {
                    this.submitForm.patchValue({
                        customer_ctrl: this.autoTrigger1.activeOption.value,
                    });
                    this.setCustomerInfo(
                        this.autoTrigger1.activeOption.value,
                        'tab'
                    );
                }
            });
    }

    searchProducts() {
        let search = '';
        this.submitForm1.controls.product_ctrl.valueChanges
            .pipe(
                debounceTime(300),
                tap(() => (this.isLoading = true)),
                switchMap((id: any) => {
                    search = id;
                    if (id != null && id.length >= 0) {
                        return this._commonApiService.getProductInfo({
                            search_text: id,
                        });
                    } else {
                        return EMPTY;
                    }
                })
            )

            .subscribe((data: any) => {
                this.isLoading = false;
                this.product_lis = data.body.result;
                this._cdr.markForCheck();
            });
    }

    reloadEnqDetails(type) {
        this.enqDetailsOrig = [];
        this._commonApiService
            .getEnquiryDetails(this.enq_id)
            .subscribe((data: any) => {
                this.enqDetailsOrig = data;

                this._commonApiService
                    .getCustomerDetails(
                        this.enqDetailsOrig.customerDetails[0].customer_id
                    )
                    .subscribe((customerData: any) => {
                        this.customer_data = customerData[0];

                        this.submitForm.patchValue({
                            customer_ctrl: customerData[0],
                        });

                        this.customer_name = customerData[0].name;
                        this.is_customer_selected = true;
                    });

                this.status = this.enqDetailsOrig.customerDetails[0].e_status;

                this.populateEnquiry(this.enqDetailsOrig?.enquiryDetails);

                this.spinner.hide();

                if (type === 'loading_now') {
                    const v1 =
                        220 +
                        this.enqDetailsOrig?.enquiryDetails.length * 70 +
                        70;
                    this.ScrollToPoint(0, v1);
                } else {
                    this.ScrollToTop();
                }

                this._cdr.markForCheck();
            });
    }

    populateEnquiry(enqList) {
        this.enquiries.clear();

        enqList.forEach((element, index) => {
            let tmpGiveQty = 0;
            // status (D) do not manipulate. default entered give qty
            if (element.status === 'D') {
                tmpGiveQty =
                    element.give_quantity === 0 ? 0 : element.give_quantity;
            } else {
                // tmpGiveQty = element.ask_quantity;
                // When status is Open (O)
                // if available stock is zero, then defaults value to 0
                tmpGiveQty =
                    element.available_stock <= 0 ? 0 : element.ask_quantity;
            }

            this.enquiries.push(
                this.addProductGroup(element, tmpGiveQty, index)
            );
            this._cdr.detectChanges();
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.autoTriggerList &&
            this.autoTriggerList.forEach((e, idx) => {
                e.panelClosingActions.subscribe((x) => {
                    if (this.autoTriggerList.toArray()[idx].activeOption) {
                        this.setItemDesc(
                            this.autoTriggerList.toArray()[idx].activeOption
                                .value,
                            idx,
                            'tab'
                        );
                    }
                    console.log('is it calling..' + JSON.stringify(x));
                });
            });
    }

    addProductGroup(element, tmpGiveQty, index) {
        const group = this._fb.group({
            id: element.id,
            enquiry_id: element.enquiry_id,
            notes: element.notes,
            ask_quantity: element.ask_quantity,
            give_quantity: tmpGiveQty,
            status: 'P',
            invoice_no: element.invoice_no,
            center_id: this.user_data.center_id,
            customer_id: element.customer_id,
            product_id: element.product_id,
            product_code: element.product_code,
            product_desc: element.product_description,
            rack: element.rack,
            qty: element.packet_size,
            packet_size: element.packet_size,
            unit_price: element.unit_price,
            mrp: element.mrp,
            available_stock: element.available_stock,
            stock_id: element.stock_id,
            processed: element.processed,
            check_box: false,
        });

        this.productList$[index] = group.get('product_code').valueChanges.pipe(
            debounceTime(300),

            switchMap((value) =>
                this._commonApiService.getProductInfo1({
                    center_id: this.user_data.center_id,
                    search_text: value,
                })
            )
        );
        return group;
    }

    searchCustomers() {
        //let search = '';
        this.submitForm.controls.customer_ctrl.valueChanges
            .pipe(
                debounceTime(300),
                tap(() => (this.isCLoading = true)),
                switchMap((id: any) => {
                    console.log(id);
                    //		search = id;
                    if (id != null && id.length >= 2) {
                        return this._commonApiService.getCustomerInfo({
                            center_id: this.user_data.center_id,
                            search_text: id,
                        });
                    } else {
                        return empty();
                    }
                })
            )

            .subscribe((data: any) => {
                this.isCLoading = false;
                this.customer_lis = data.body;
                this._cdr.markForCheck();
            });
    }

    displayFn(obj: any): string | undefined {
        return obj && obj.name ? obj.name : undefined;
    }

    setCustomerInfo(event, from) {
        if (from === 'click' && event.option.value === 'new') {
            this.addCustomer();
        }

        if (from === 'tab') {
            this.customer_data = event;
            this.is_customer_selected = true;
        } else {
            this.customer_data = event.option.value;

            this.is_customer_selected = true;
        }

        this._cdr.markForCheck();
    }

    clearInput() {
        this.submitForm.patchValue({
            customer_ctrl: null,
        });

        this.is_customer_selected = false;

        this._cdr.markForCheck();
    }

    clearProdInput(index) {
        this.enquiries.controls[index].patchValue({
            product_id: null,
            product_code: null,
            product_desc: null,
            available_stock: null,
            give_quantity: 0,
        });

        this._cdr.markForCheck();
    }

    clearProdInput1() {
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

    save(param) {
        if (!this.is_customer_selected) {
            this.presentAlert('Select customer to proceed !!!');
            return false;
        }

        this.executeDeletes();

        if (
            this.enqDetailsOrig.customerDetails[0].customer_id !==
            this.customer_data.id
        ) {
            this.updateCustomerDetailsInEnquiry();
        }

        if (!this.submitForm.valid) {
            this.presentAlert(
                'Form incomplete, Verify if any missing entries !!!'
            );
            return false;
        }

        //main submit
        this.clicked = true; // disable all buttons after submission
        this._cdr.markForCheck();
        this.spinner.show();

        if (this.submitForm.value.enquiries.length === 0) {
            this.presentAlert('Nothing to save, add cart before saving!');
            this.spinner.hide();
            return false;
        }

        this._commonApiService
            .draftEnquiry(this.submitForm.value.enquiries)
            .subscribe((data: any) => {
                this.spinner.hide();
                if (data.body.result === 'success') {
                    if (param === 'add-item') {
                        this.clicked = false;
                        //	this.openAddItem();
                    } else {
                        this._router.navigate([
                            `/home/enquiry/open-enquiry/O/weekly`,
                        ]);
                    }
                } else {
                }

                this._cdr.markForCheck();
            });
    }

    displayProdFn(obj: any): string | undefined | any {
        return obj && obj.product_code ? obj.product_code : obj;
    }

    onClick(selItem) {
        this.selectedEnq = selItem.id;
    }

    isSelected(item) {
        if (item.id === this.selectedEnq) {
            return 'grey';
        }
    }

    checkedRow(idx) {
        setTimeout(() => {
            if (this.enquiries.controls[idx].value.processed === 'YS') {
                this.enquiries.controls[idx].patchValue({
                    processed: 'NO',
                });
            } else if (this.enquiries.controls[idx].value.processed === 'NO') {
                this.enquiries.controls[idx].patchValue({
                    processed: 'YS',
                });
            }

            this._cdr.markForCheck();

            this._cdr.detectChanges();
        }, 10);
    }

    checkedDelRow(idx: number) {
        if (!this.enquiries.controls[idx].value.check_box) {
            this.enquiries.controls[idx].value.check_box = true;
            this.removeRowArr.push(idx);
        } else if (this.enquiries.controls[idx].value.check_box) {
            this.enquiries.controls[idx].value.check_box = false;
            this.removeRowArr = this.removeRowArr.filter((e) => e !== idx);
        }
        this.delIconStatus();
    }

    moveToSale() {
        if (!this.is_customer_selected) {
            this.presentAlert('Select customer to proceed !!!');
            return false;
        }

        if (
            this.enqDetailsOrig.customerDetails[0].customer_id !==
            this.customer_data.id
        ) {
            this.updateCustomerDetailsInEnquiry();
        }

        //main (2) secondary button submit
        this.clicked = true; // disable all buttons after submission
        this._cdr.markForCheck();
        this.spinner.show();

        const formToMoveSale = {
            enquiries: this.submitForm.value.enquiries,
            user_id: this.user_data.user_id,
        };

        this._commonApiService
            .moveToSale(formToMoveSale)
            .subscribe((data: any) => {
                this.spinner.hide();
                if (data.body.result === 'success') {
                    this._router.navigate([
                        `/home/enquiry/open-enquiry/O/weekly`,
                    ]);
                } else {
                }

                this._cdr.markForCheck();
            });
    }

    updateCustomerDetailsInEnquiry() {
        this._commonApiService
            .updateCustomerDetailsInEnquiry(this.customer_data.id, this.enq_id)
            .subscribe((data: any) => {
                if (data.body.result === 'success') {
                    // do nothing
                }
            });
    }

    openEnquiry() {
        this._router.navigateByUrl(`/home/enquiry/open-enquiry/O/weekly`);
    }

    goEnquiryScreen() {
        this._router.navigateByUrl(`/home/enquiry`);
    }

    async presentAlertConfirm() {
        const atLeastOneValidEntry = this.submitForm.value.enquiries.filter(
            (e) => e.give_quantity !== 0
        );

        if (atLeastOneValidEntry.length === 0) {
            // attn move all to back order to be implemented
            this.moveToSaleFinalConfirm(
                'Only Back orders, Nothing to move to sale. Continue?',
                'Continue'
            );
        } else {
            this.moveToSaleFinalConfirm(
                'Are you sure, Orders processing completed?',
                'Yes, Move to Sale'
            );
        }
    }

    async moveToSaleFinalConfirm(param, action) {
        const alert = await this.alertController.create({
            header: 'Confirm!',
            message: param,
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
                    text: action,
                    handler: () => {
                        console.log('Confirm Okay');
                        this.executeDeletes();
                        this.moveToSale();
                    },
                },
            ],
        });

        await alert.present();
    }

    async presentDeleteConfirm() {
        const alert = await this.alertController.create({
            header: 'Confirm!',
            message: 'Are You sure to delete!!!',
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
                        this.onRemoveRows();
                    },
                },
            ],
        });

        await alert.present();
    }

    executeDeletes() {
        this.deletedRowArr.sort().reverse();
        this.deletedRowArr.forEach((e) => {
            this.executeDeleteProduct(e);
        });
    }

    executeDeleteProduct(elem) {
        this._commonApiService
            .deleteEnquiryDetails({
                id: elem.id,
                enquiry_id: elem.enquiry_id,
                qty: elem.ask_quantity,
                product_id: elem.product_id,
                notes: elem.notes,
                audit_needed: true,
            })
            .subscribe((data: any) => {
                if (data.body.result === 'success') {
                    console.log('object >>> execute delete product ...');
                } else {
                    this.spinner.hide();
                    this.presentAlert(
                        'Error: Something went wrong Contact Admin!'
                    );
                }

                this._cdr.markForCheck();
            });

        this._cdr.markForCheck();
    }

    onRemoveRows() {
        this.removeRowArr.sort(this.compare).reverse();

        this.removeRowArr.forEach((e) => {
            this.deleteProduct(e);
        });
    }

    compare(a: number, b: number) {
        return a - b;
    }

    deleteProduct(idx) {
        if (this.enquiries.controls[idx].value.id !== '') {
            this.deletedRowArr.push(this.enquiries.controls[idx].value);
        }

        this.enquiries.removeAt(idx);

        this.removeRowArr = this.removeRowArr.filter((e) => e !== idx);

        this.delIconStatus();

        this._cdr.markForCheck();
    }

    delIconStatus() {
        if (this.removeRowArr.length > 0) {
            this.showDelIcon = true;
        } else {
            this.showDelIcon = false;
        }
    }

    async beforeAddItemConfirm() {
        const alert = await this.alertController.create({
            header: 'Confirm!',
            message: 'Recent changes will be draft saved before add items.',
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
                    text: 'Yes, go ahead',
                    handler: () => {
                        console.log('Confirm Okay');
                        this.save('add-item');
                    },
                },
            ],
        });

        await alert.present();
    }

    addCustomer() {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.width = '80%';
        dialogConfig.height = '80%';

        const dialogRef = this._dialog.open(
            CustomerAddDialogComponent,
            dialogConfig
        );

        dialogRef
            .afterClosed()
            .pipe(
                filter((val) => !!val),
                tap(() => {
                    // do nothing check
                    this._cdr.markForCheck();
                })
            )
            .subscribe((data: any) => {
                if (data !== 'close') {
                    this._commonApiService
                        .getCustomerDetails(data.body.id)
                        .subscribe((customerData: any) => {
                            this.customer_data = customerData[0];

                            this.customer_name = customerData[0].name;
                            this.is_customer_selected = true;

                            this.setCustomerInfo(customerData[0], 'tab');

                            this.submitForm.patchValue({
                                customer_ctrl: customerData[0],
                            });

                            this.isCLoading = false;
                            this.autoTrigger1.closePanel();

                            this._cdr.markForCheck();
                        });
                } else {
                    this.is_customer_selected = false;
                    this.autoTrigger1.closePanel();

                    this._cdr.markForCheck();
                }

                this._cdr.markForCheck();
            });
    }

    openDialog(event): void {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.width = '400px';
        dialogConfig.height = '100%';
        dialogConfig.data = this.customer_data;
        dialogConfig.position = { top: '0', right: '0' };

        const dialogRef = this._dialog.open(
            CustomerViewDialogComponent,
            dialogConfig
        );

        dialogRef.afterClosed().subscribe((result) => {
            console.log('The dialog was closed');
        });
    }

    reset() {}

    exportToExcel() {}

    logScrolling(event) {
        if (this.autoTrigger1 && this.autoTrigger1.panelOpen) {
            this.autoTrigger1.closePanel();
        }
    }

    async presentCancelConfirm() {
        const alert = await this.alertController.create({
            header: 'Confirm!',
            message: 'Are you sure to leave the page?',
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
                        // this.cancel();
                        //main cancel
                        this.clicked = true; // disable all buttons after submission
                        this._cdr.markForCheck();
                        this._router.navigateByUrl(
                            '/home/enquiry/open-enquiry/O/weekly'
                        );
                    },
                },
            ],
        });

        await alert.present();
    }

    setItemDesc(event, index, from) {
        if (from === 'click') {
            this.populateFormValues(index, event.option.value);
        } else {
            this.populateFormValues(index, event);
        }

        this._cdr.markForCheck();
        this._cdr.detectChanges();
    }

    populateFormValues(index, formObject) {
        this.enquiries.controls[index].patchValue({
            product_id: formObject.product_id,
            product_code: formObject.product_code,
            product_desc: formObject.description,
            qty: formObject.packet_size,
            packet_size: formObject.packet_size,
            unit_price: formObject.unit_price,
            mrp: formObject.mrp,
            status: 'P',
            stock_id: formObject.stock_id,
            available_stock: formObject.available_stock,
            rack: formObject.rack,
        });
    }

    onSubmit() {
        const form = {
            enquiry_id: +this.enq_id,
            product_id: this.submitForm1.value.product_ctrl.product_id,
            ask_quantity: this.submitForm1.value.temp_quantity,
            product_code: this.submitForm1.value.product_ctrl.product_code,
            notes: this.submitForm1.value.temp_desc,
            status: 'O',
        };

        this._commonApiService.addMoreEnquiry(form).subscribe((data: any) => {
            this.submitForm1.reset();
            this.myForm1.resetForm();
            this.submitForm1.patchValue({
                enquiry_id: this.enq_id,
                center_id: this.user_data.center_id,
            });
            this.reloadEnqDetails('loading_now');
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this.plist && this.plist.nativeElement.focus();
            this.openSnackBar('Item added to Order queue', '');

            this._cdr.markForCheck();
        });
    }

    addProduct() {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.width = '50%';
        dialogConfig.height = '100%';
        dialogConfig.position = { top: '0', right: '0' };

        const dialogRef = this._dialog.open(
            ProductAddDialogComponent,
            dialogConfig
        );

        dialogRef
            .afterClosed()
            .pipe(
                filter((val) => !!val),
                tap(() => {
                    this._cdr.markForCheck();
                })
            )
            .subscribe((data: any) => {
                if (data === 'success') {
                    const dialogConfigSuccess = new MatDialogConfig();
                    dialogConfigSuccess.disableClose = false;
                    dialogConfigSuccess.autoFocus = true;
                    dialogConfigSuccess.width = '25%';
                    dialogConfigSuccess.height = '25%';
                    dialogConfigSuccess.data = 'Product added successfully';

                    this._dialog.open(
                        SuccessMessageDialogComponent,
                        dialogConfigSuccess
                    );
                }
            });
    }

    setItemDesc1(event, from) {
        if (from === 'tab') {
            this.submitForm1.patchValue({
                temp_desc: event.product_description,
                temp_quantity: event.packet_size === 0 ? 1 : event.packet_size,
            });
            this.lineItemData = event;
            this.selected_description = event.product_description;
            this.selected_mrp = event.mrp;
            this._cdr.markForCheck();
            //this.qty && this.qty.nativeElement.focus();
        } else {
            this.submitForm1.patchValue({
                temp_desc: event.option.value.product_description,
                temp_quantity:
                    event.option.value.packet_size === 0
                        ? 1
                        : event.option.value.packet_size,
            });
            this.lineItemData = event.option.value;
            this.selected_description = event.option.value.product_description;
            this.selected_mrp = event.option.value.mrp;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            this.qty && this.qty.nativeElement.focus();
            this._cdr.markForCheck();
        }
    }

    openSnackBar(message: string, action: string) {
        this._snackBar.open(message, action, {
            duration: 2000,
            panelClass: ['mat-toolbar', 'mat-primary'],
        });
    }

    ScrollToPoint(X, Y) {
        this.content.scrollToPoint(X, Y, 300);
    }

    ScrollToTop() {
        this.content.scrollToTop(1500);
    }
}
