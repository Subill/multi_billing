import React from 'react';
import {Elements, injectStripe, CardElement, StripeProvider} from 'react-stripe-elements';
import {ServicebotBaseForm, Fetcher, inputField} from "servicebot-base-form"
import {get, has} from "lodash";
import {Field,} from 'redux-form'
import Buttons from "../utilities/buttons.js";
import {connect} from "react-redux";
import creditCardIcon from "../utilities/credit-card-icons.js";
import Alerts from "../utilities/alerts.js"
import Load from "../utilities/load";
import PaystackButton from "react-paystack";

class CardSection extends React.Component {
    render() {
        return (
            <div className="sb-form-group" id="card-element">
                
            </div>
        );
    }
}

class BillingForm extends React.Component {

    constructor(props){
        super(props);
        this.state = {  loading: false,
            CardModal: false,
            alerts: null,
            hasCard: false,
            loading: true,
            showForm: false,
            card: {},
            rows: {},
            cardObject: {},
            url: `/api/v1/funds`
        };
        this.fetchUser = this.fetchUser.bind(this);
    }

    callback (response) {
        if (response.reference) {
            this.setState({ alerts: {
                type: 'success',
                icon: 'check',
                message: 'Your card has been updated.'
            }});
        }
        else {
            this.setState({ alerts: {
                type: 'danger',
                icon: 'time',
                message: 'Your card has not been updated.'
            }});
        }
        //alert('success. transaction ref is ' + apiURL.message);
        console.log(response); // card charged successfully, get reference here
    }

     fetchUser() {
         let self = this;
         //let fund = self.props.userFund.user_id;
            Fetcher(`/api/v1/users/${this.props.uid}`).then(function (response) {
                 if (response) {
                         self.setState({
                             email: response.name || response.email,
                         });
                 }
            });
     }

    close() {
        console.log("Payment closed");
    }

    getReference() {
        //you can put any unique reference implementation code here
        let text = "verify";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.=";

        for( let i=0; i < 15; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    getAlerts() {
        if(this.state.alerts){
            return ( <Alerts type={this.state.alerts.type} message={this.state.alerts.message}
                             position={{position: 'fixed', bottom: true}} icon={this.state.alerts.icon} /> );
        }
    }

    render() {

        if(this.props.userFund){
            this.state.hasCard = true;
            this.state.card = this.props.userFund.source.card;
        }

        if (this.state.hasCard) {
            return (
                <div className="card-accordion">
                {this.getAlerts()}
                    <p>
                        <i className={creditCardIcon(this.state.card.brand)}/>
                        {this.state.card.brand} ending in <span className="last4">{this.state.card.last4}</span>
                        <span className="exp_month">{this.state.card.exp_month}</span> /
                        <span className="exp_year">{this.state.card.exp_year}</span>
                    </p>
                
                <hr/>
                <PaystackButton
                text="Update Payment"
                class="buttons _default"
                //class="payButton"
                //className="btn btn-default btn-rounded btn-md m-r-5 application-launcher"
                callback={this.callback}
                close={this.close}
                disabled={false}
                embed={false}
                reference={this.getReference()}
                email={this.state.email}
                amount={5000}
                paystackkey={this.props.spk || "no_public_token"}
                {...this.props}
              />
              
              </div>
            )

        }
        else {
            return (
                //<CreditCardForm {...this.props}/>
                <div className="service-instance-box-content">
                <h3><i className="fa fa-credit-card"/>Your credit/debit card</h3>
                {this.getAlerts()}
                <hr/>
                <PaystackButton
                text="Add your card"
                class="buttons _default"
                //class="payButton"
                //className="btn btn-default btn-rounded btn-md m-r-5 application-launcher"
                callback={this.callback}
                close={this.close}
                disabled={false}
                embed={false}
                reference={this.getReference()}
                email={this.state.email}
                amount={5000}
                paystackkey={this.props.spk || "no_public_token"}
                {...this.props}
              />
              </div>
            )
        }
        /*return (
            <StripeProvider apiKey={this.props.spk}>
                <Elements id="payment-form">
                    <CreditCardForm {...this.props}/>
                </Elements>
            </StripeProvider>

        )*/
    }
}

function BillingInfo(props) {
    let {invalid, submitting, pristine} = props;
    return (
        <form className="mbf--funding-personal-info">
            <CardSection/>
            <Field name="name" type="text" component={inputField} placeholder="Name on Card"/>
            {/*<Field name="address_line1" type="text" component={inputField} placeholder="Address"/>*/}
            {/*<Field name="address_city" type="text" component={inputField} placeholder="City"/>*/}
            {/*<Field name="address_state" type="text" component={inputField} placeholder="State"/>*/}
            <div className={`mbf--funding-save-button-wrapper`}>
            <button disabled={invalid|| submitting || pristine} className="buttons _primary mbf--btn-update-funding-save"
                    onClick={props.handleSubmit} type="submit">Save Card</button>
            </div>
        </form>
    )
}

class CreditCardForm extends React.Component {
    constructor(props) {
        super(props);
        let state = {
            hasCard: false,
            loading: true,
            card: {},
            alerts: null,
            showForm: true
        };
        if(props.userFund){
            state.hasCard= true;
            state.showForm = false;
            state.card = props.userFund.source.card;
        }
        this.state = state;
        this.submissionPrep = this.submissionPrep.bind(this);
        // this.checkIfUserHasCard = this.checkIfUserHasCard.bind(this);
        this.handleSuccessResponse = this.handleSuccessResponse.bind(this);
        this.handleFailureResponse = this.handleFailureResponse.bind(this);
        this.showPaymentForm = this.showPaymentForm.bind(this);
        this.hidePaymentForm = this.hidePaymentForm.bind(this);
    }

    componentDidMount() {
        let self = this;
            self.setState({
                loading: false,
            });
    }

    async submissionPrep(values) {
        this.props.setLoading(true);
        let token = await this.props.stripe.createToken({...values});
        if (token.error) {
            let message = token.error;
            if(token.error.message) {
                message = token.error.message;
            }
            this.setState({ alerts: {
                type: 'danger',
                icon: 'times',
                message: message
            }});
            this.props.setLoading(false);
            throw token.error
        }
        return {user_id: this.props.uid, token_id: token.token.id};
    }

    // checkIfUserHasCard() {
    //     let self = this;
    //         Fetcher(`/api/v1/users/${self.props.uid}`).then(function (response) {
    //             if (!response.error) {
    //                 if (has(response, 'references.funds[0]') && has(response, 'references.funds[0].source.card')) {
    //                     let fund = get(response, 'references.funds[0]');
    //                     let card = get(response, 'references.funds[0].source.card');
    //                     self.setState({
    //                         loading: false,
    //                         displayName: response.name || response.email || "You",
    //                         hasCard: true,
    //                         fund: fund,
    //                         card: card,
    //                         personalInformation: {
    //                             name: card.name || "",
    //                             address_line1: card.address_line1 || "",
    //                             address_city: card.address_city || "",
    //                             address_state: card.address_state || "",
    //                         }
    //                     }, function () {
    //                     });
    //                 } else {
    //                     self.setState({
    //                         loading: false,
    //                         showForm: true
    //                     });
    //                 }
    //             } else {
    //                 self.setState({loading: false, hasCard: false});
    //             }
    //         });
    // }

    handleSuccessResponse(response) {
        //If the billing form is passed in a callback, call it.

        if(this.props.handleResponse) {
            this.props.handleResponse(response);
            //Otherwise, set own alert.
        } else {
            this.setState({ alerts: {
                type: 'success',
                icon: 'check',
                message: 'Your card has been updated.'
            }});
            //re-render
            // this.checkIfUserHasCard();
        }
        this.props.setLoading(false);

    }

    handleFailureResponse(response) {
        if (response.error) {
            this.setState({ alerts: {
                type: 'danger',
                icon: 'times',
                message: response.error
            }});
        }
        this.props.setLoading(false);

    }

    showPaymentForm(){
        this.setState({ showForm: true });
    }

    hidePaymentForm(){
        this.setState({ showForm: false });
    }

    render() {
        let submissionRequest = {
            'method': 'POST',
            'url': `${this.props.url}/api/v1/funds`,
        };

        if(this.props.submitAPI) {
            submissionRequest.url = this.props.submitAPI;
        }


        let card = {}
        let {hasCard, displayName} = this.state;
        if(this.props.userFund){
            hasCard = true;
            card = this.props.userFund.source.card;
        }


        let {brand, last4, exp_month, exp_year} = card;

        let getCard = ()=>{
            if(hasCard) {
                return (
                    <div className={`mbf--card-wrapper ${this.state.showForm && "show-form"}`}>
                        <div className="mbf--card-display">
                            <div className="mbf--card-number-holder">
                                <span className="mbf--card-brand">
                                    {creditCardIcon(brand)}
                                </span>{brand} ending in <span className="mbf--card-last4">{last4}</span>
                                <span className="mbf--card-date-holder">
                                    Expires
                                    <span className="mbf--card-exp-month">{exp_month} / </span>
                                    <span className="mbf--card-exp-year">{exp_year}</span>
                                </span>
                            </div>
                            {!this.state.showForm &&
                            <div className="mbf--update-funding-button-wrapper">
                                <button className="buttons _primary _rounded mbf--btn-update-funding" onClick={this.showPaymentForm}>Update</button>
                            </div>
                            }
                        </div>
                        {this.state.showForm &&
                            <div className="mbf--update-funding-wrapper">
                                <div className="mbf--funding-form-element update-card-container">
                                    <ServicebotBaseForm
                                        form={BillingInfo}
                                        formProps={{...this.props}}
                                        initialValues={{...this.state.personalInformation}}
                                        submissionPrep={this.submissionPrep}
                                        submissionRequest={submissionRequest}
                                        successMessage={"Fund added successfully"}
                                        customLoader={()=> {console.log("Calling checkout loader"); return <Load className={`subill-embed-custom-loader __form`}/>}}
                                        handleResponse={this.handleSuccessResponse}
                                        handleFailure={this.handleFailureResponse}
                                        reShowForm={true}
                                        external={this.props.external}
                                        token={this.props.token} />
                                </div>
                                <button className="buttons _text mf--btn-cancel-update-funding" onClick={this.hidePaymentForm}>Cancel</button>
                            </div>
                        }
                    </div>
                )
            }else{
                return (
                    <div className={`add-new-card-container`}>
                        <div className="mbf--update-funding-wrapper">
                            <div className="mbf--funding-form-element">
                                <ServicebotBaseForm
                                    form={BillingInfo}
                                    formProps={{...this.props}}
                                    initialValues={{...this.state.personalInformation}}
                                    submissionPrep={this.submissionPrep}
                                    submissionRequest={submissionRequest}
                                    successMessage={"Fund added successfully"}
                                    handleResponse={this.handleSuccessResponse}
                                    handleFailure={this.handleFailureResponse}
                                    reShowForm={true}
                                    external={this.props.external}
                                    token={this.props.token} />
                            </div>
                        </div>
                    </div>
                )
            }
        };

        let getAlerts = ()=>{
            if(this.state.alerts){
                return ( <Alerts type={this.state.alerts.type} message={this.state.alerts.message}
                                 position={{position: 'fixed', bottom: true}} icon={this.state.alerts.icon} /> );
            }
        };

        return (
            <div id="mbf--funding-form">
                {getAlerts()}
                {getCard()}
            </div>
        );
    }
}

let mapDispatchToProps = function(dispatch){
    return {
        setLoading : function(is_loading){
            dispatch({type: "SET_LOADING", is_loading});
        }}
};

//CreditCardForm = injectStripe(CreditCardForm);
CreditCardForm = connect(null, mapDispatchToProps)(CreditCardForm);

export {CreditCardForm, BillingForm, CardSection};
