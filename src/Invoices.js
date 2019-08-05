import React from "react";
import {Price} from './utilities/price.js';
import DateFormat from './utilities/date-format.js';
import ReactToPrint from "react-to-print";
import RavePaymentModal from 'react-ravepayment';

class Invoice extends React.Component {
    constructor(props) {
        super(props)
    }
    render() {
        let {invoice, user, cancel} = this.props;
        return (
            <div className={`subill-invoice-modal-container`} ref={el => (this.componentRef = el)}>
                <div className={`__modal`}>
                    <div className={`__header`}>
                        <div className={`__inner`}>
                            <div className={`__left`}>
                                <h3>{user.name || user.email}</h3>
                                <span className={`__invoice-id`}>Invoice #: {invoice.invoice_id}</span>
                                <span className={`__date`}><DateFormat date={invoice.date}/></span>
                            </div>
                            <div className={`__right`}>
                            <span role={`button`}
                                  aria-label={`close invoice modal`}
                                  className={`icon close`}
                                  onClick={cancel}/>
                            </div>
                        </div>
                    </div>
                    <div className={`__body`}>
                        <h4 className={`__heading`}>Summary</h4>
                        <div className={`mbf-summary`}>
                            <p className={`_heading`}>Items</p>
                            <div className={`_items`}>
                                {invoice.references.user_invoice_lines.map((line, index) => {
                                    return (
                                        <p key={index} className={`_item`}>
                                            <span className={`_label`}>{line.description}</span>
                                            <span className={`_value_wrap`}>
                                                <span className={`_value`}>
                                                    <Price value={line.amount} currency={line.currency}/>
                                                </span>
                                            </span>
                                        </p>
                                    );
                                })}
                            </div>
                            <p className={`_total`}>
                                <span className={`_label`}>Total: </span>
                                <span className={`_value`}><Price value={invoice.total}
                                                                  currency={invoice.currency}/></span>
                            </p>
                        </div>
                    </div>
                    <div className={`__footer`}>
                        <ReactToPrint
                            copyStyles={true}
                            bodyClass="subill--embeddable--print"
                            trigger={() => <button onClick={(e) => {
                                window.print();
                                return false;
                            }} className={`buttons _primary _download-invoice`}>Print Invoice</button>}
                            content={() => this.componentRef}
                        />
                    </div>
                </div>
                <div onClick={cancel} className={`__backdrop`}/>
            </div>
        );
    }
}
class Invoices extends React.Component {
    constructor(props){
        super(props)
        let invoice = this.props;
        this.state = {
            invoiceToShow : null,
            tid: invoice.t_id,
            loading: true,
            alerts: null
        }
        this.cancel = this.cancel.bind(this);
        this.viewInvoice = this.viewInvoice.bind(this);
        this.getSPK = this.getSPK.bind(this);
        this.getCurrency = this.getCurrency.bind(this);

    }

    componentDidMount() {
        this.getSPK();
        this.getCurrency();
    }

    cancel(){
        this.setState({invoiceToShow : null});
    }
    viewInvoice(invoiceToShow){
        let self = this;
        return function(e){
            self.setState({invoiceToShow})
        }
    }

    callback (response) {
        let txref = response.tx.txRef;
        if (response.tx.chargeResponseCode == "00" || response.tx.chargeResponseCode == "0") {
            Fetcher("/api/v1/fund/verification", "POST", txref).then(function (result) {
                if (!result.error) {
                    this.setState({ alerts: {
                        type: 'success',
                        icon: 'check',
                        message: 'Your Payment was Successful.'
                    }});
                }
            })
        }
        else {
            this.setState({ alerts: {
                type: 'danger',
                icon: 'time',
                message: 'Your Payment was unsuccessful.'
            }});
        }
        //alert('success. transaction ref is ' + apiURL.message);
        console.log(response); // card charged successfully, get reference here
    }

    close() {
        console.log("Payment closed");
    }

    getReference() {
        //you can put any unique reference implementation code here
        let text = "SUBILL-";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.=";

        for( let i=0; i < 10; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    getAlerts() {
        if(this.state.alerts){
            return ( <Alerts type={this.state.alerts.type} message={this.state.alerts.message}
                             position={{position: 'fixed', bottom: true}} icon={this.state.alerts.icon} /> );
        }
    }

    getSPK(){
        let self = this;
        let tid = self.state.tid;
        fetch(`${this.props.url}/api/v1/stripe/spk/${tid}`).then(function(response) {
                return response.json()
            }).then(function(json) {
            self.setState({loading:false, spk : json.spk});
        }).catch(e => console.error(e));
    }

    getCurrency(){
        let self = this;
        fetch(`${this.props.url}/api/v1/tenant-system-options`).then(function(response) {
                return response.json()
            }).then(function(json) {
            self.setState({currency : json.currency});
        }).catch(e => console.error(e));
    }

    render() {
        let {invoices, user} = this.props;
        let {invoiceToShow} = this.state;
        let spk = this.state.spk;
        let currency = this.state.currency;
        if (!invoices || invoices.length === 0) {
            return <div></div>
        }

        return <div className={`subill-billing-invoices`}>
            {invoiceToShow !== null && <Invoice cancel={this.cancel} user={user} invoice={invoices[invoiceToShow]}/>}
            <h3>Billing Invoice</h3>
            <ul className={`__invoice-list-header`}>
                <li>Invoice ID</li>
                <li>Date</li>
                <li>Amount</li>
                <li>Pending Payment</li>
                <li>Action</li>
            </ul>
            <ul className={`__invoice-list`}>
            {invoices.map((invoice, index) => {
                return (
                    <li key={`invoice-${index}`} className={`__list-items`}>
                        <span className={`__invoice-id`}>{invoice.invoice_id.slice(3)}</span>
                        <span className={`__invoice-date`}><DateFormat month={true} date={invoice.date}/></span>
                        <span className={`__invoice-amount`}><Price value={invoice.total} currency={invoice.currency}/></span>
                        {invoice.paid == false ? <span><RavePaymentModal
                                text="Pay now"
                                class="buttons __invoice-button"
                                callback={this.callback}
                                close={this.close}
                                currency={currency}
                                reference={this.getReference()}
                                email={user.email}
                                amount={invoice.amount_due}
                                ravePubKey={spk}
                                isProduction= {false}
                                tag= "button"
                        /></span> : <span className={`buttons __invoice-button`}>None</span>}
                        <span className={`buttons __invoice-button`} onClick={this.viewInvoice(index)}>View Invoice</span>
                    </li>
                )
            })}
            </ul>
        </div>
    }
}
export default Invoices