import React from 'react';
import {Fetcher} from 'servicebot-base-form';
import {Price, getPrice} from '../utilities/price.js';
import DateFormat from "../utilities/date-format.js";
import {BillingForm} from "./billing-settings-form.js";
import {injectStripe} from "react-stripe-elements";
import {connect} from "react-redux";
import {ModalEditProperties} from "./edit-properties-form.js"
import TierChoose from "./TierChooser"
import {PriceBreakdown} from "../utilities/widgets";
import Load from "../utilities/load.js";
import Invoices from "../Invoices"

function PriceSummary(props){
    let {instance, template} = props;

    return (
        <div className="_items">
            <PriceBreakdown instance={instance} inputs={instance.references.service_instance_properties}/>
            <p className="_total"><span className="_label">Total:</span><span className="_value">{getPrice(instance)}</span></p>
        </div>
    );
}
class ServicebotManagedBilling extends React.Component {

    constructor(props){
        super(props);
        this.state = {
            instances: [],
            funds: [],
            user: {},
            fund_url : "api/v1/funds",
            spk: null,
            loading:true,
            cancel_modal: false,
            token: null,
            error: null,
            propEdit: false,
            currentInstance: {}
        };
        this.getServicebotDetails = this.getServicebotDetails.bind(this);
        this.requestCancellation = this.requestCancellation.bind(this);
        this.handleResponse = this.handleResponse.bind(this);
        this.getRequest = this.getRequest.bind(this);
        this.showPropEdit = this.showPropEdit.bind(this);
        this.hidePropEdit = this.hidePropEdit.bind(this);
        this.changePlan = this.changePlan.bind(this);

    }

    componentDidMount() {
        let self = this;
        self.getSPK();
        //self.getUser();
        self.getServicebotDetails();
        self.getFundingDetails();
        self.getInvoices();
    }

    handleResponse(instance){
        let self = this;
        return async (response)=> {
            self.props.handleResponse && self.props.handleResponse({event: "add_fund",response});
            if(instance.status === "cancelled" && self.state.instances.length === 1){
                await self.resubscribe(instance.id)();
            }else if(self.state.formError || self.state.resubscribeError){
                self.setState({formError: null, resubscribeError: null});
            }

            self.getFundingDetails();
            self.props.setLoading(false);
        }

    }
    async getInvoices(){
        let invoices = await Fetcher(`${this.props.url}/api/v1/invoices/own`, null, null, this.getRequest());
        this.setState({invoices})
    }
    async getFundingDetails(){
        let funds = await Fetcher(`${this.props.url}/api/v1/funds/own`, null, null, this.getRequest());
        this.setState({funds})
    }

    getRequest(method="GET", body){
        let headers = {
            "Content-Type": "application/json"
        };
        if(this.props.token){
            headers["Authorization"] = "JWT " + this.props.token;
        }
        let request = { method: method,
            headers: new Headers(headers),
        };
        if(method === "POST" || method==="PUT"){
            request.body = JSON.stringify(body)
        }
        return request;
    }
    getSubscriptionStatus(instance){
        if(instance.status === "cancelled"){
            if(this.state.funds.length === 0 && instance.payment_plan && instance.payment_plan.body.data.amount > 0) {
                return <div>
                    <p className={"form-help-text"}><strong>Status: cancelled, please update credit/debit card to reactivate</strong></p>

                </div>
            }else{
                return <div>
                    <p className={"form-help-text"}><strong>Status: cancelled</strong></p>
                </div>
            }
        }else if(instance.status === "cancellation_pending"){
            return <div>
                <p className={"form-help-text"}><strong>Status: Subscription will not renew after this billing cycle</strong></p>
            </div>

        }
        else{
            return <div/>
        }

    }
    async getServicebotDetails() {
        let self = this;
        let url = this.props.serviceInstanceId ? `${self.props.url}/api/v1/service-instances/${this.props.serviceInstanceId}` : `${self.props.url}/api/v1/service-instances/own`
        //let url = `${self.props.url}/api/v1/service-instances/own`
        let instances = await Fetcher(url, "GET", null, this.getRequest("GET"));
        if(this.props.serviceInstanceId){
            instances = [instances];
        }
        if(!instances.error && instances.length > 0){
            let templates = {}
            for(let instance of instances){
                if(!templates[instance.service_id]){
                    templates[instance.service_id] = await Fetcher(`${self.props.url}/api/v1/service-templates/${instance.service_id}/request`, "GET", null, this.getRequest("GET"))
                }
            }
            self.setState({instances, templates});
        }else{
            if(instances.length === 0){
                self.setState({error: "You do not have any subscriptions"});
                if(self.props.handleResponse){

                    self.props.handleResponse({error: "No subscriptions"})
                }
            }else if(instances.error) {
                self.setState({error: instances.error});
                if(self.props.handleResponse) {
                    self.props.handleResponse({error: instances.error})
                }

            }else{
                self.setState({error: "Error gathering billing information"});
                if(self.props.handleResponse) {

                    self.props.handleResponse({error: "Error"})
                }

            }
        }
    }

    async getUser(){
        let self = this;
        let url = this.props.serviceInstanceId ? `${self.props.url}/api/v1/service-instances/${this.props.serviceInstanceId}` : `${self.props.url}/api/v1/service-instances/own`
        let instances = await Fetcher(url, "GET", null, this.getRequest("GET"));
        let tid = instances.t_id;
        Fetcher(user_url).then(function (response) {
            if (!response.error) {
                self.setState({user: response});
                //console.log('fetched all users', self.state.rows);
                //return console.log(response);
            }
        });
    }

    async getSPK(){
        let self = this;
        let url = this.props.serviceInstanceId ? `${self.props.url}/api/v1/service-instances/${this.props.serviceInstanceId}` : `${self.props.url}/api/v1/service-instances/own`
        let instances = await Fetcher(url, "GET", null, this.getRequest("GET"));
        if(this.props.serviceInstanceId){
            instances = [instances];
        }
        for(let instance of instances){
            var tid = instance.t_id;
        }
        fetch(`${this.props.url}/api/v1/stripe/spk/${tid}`)
            .then(function(response) {
                return response.json()
            }).then(function(json) {
            self.setState({spk : json.spk});
        }).catch(e => console.error(e));
    }

    requestCancellation(id){
        this.props.setLoading(true);

        let self = this;
        let body = {
            instance_id : id
        };
        Fetcher(`${this.props.url}/api/v1/service-instances/${id}/request-cancellation`, null, null, this.getRequest("POST", body)).then(function (response) {
            if (!response.error) {
                self.getServicebotDetails();
                self.props.handleResponse && self.props.handleResponse({event: "cancellation", response});
                self.props.setLoading(false);
            }
        });
    }

    getTrialStatus(instance){
        let self = this;
        //Get service trial status
        if(instance) {
            let inTrial = false;
            let trialExpires = '';
            if(!instance.trial_end){
                return null;
            }
            let trial = new Date(instance.trial_end);
            let date_diff_indays = (date1, date2) => {
                let dt1 = new Date(date1);
                let dt2 = new Date(date2);
                return Math.floor((Date.UTC(dt2.getFullYear(), dt2.getMonth(), dt2.getDate()) - Date.UTC(dt1.getFullYear(), dt1.getMonth(), dt1.getDate()) ) /(1000 * 60 * 60 * 24));
            };
            if(instance.status === "running") {
                let currentDate = new Date();
                //Service is trialing if the expiration is after current date
                if(currentDate < trial) {
                    inTrial = true;
                    trialExpires = `${date_diff_indays(currentDate, trial)} days`;
                }
            }
            if(inTrial) {
                if(self.state.funds.length === 0) {
                    return (
                        <div className="sb-trial-notice">
                            <p className={"form-help-text"}><strong>{trialExpires} left of the trial </strong> and you have no funding source. Your subscription will be deactivated after trial expiration date. If you would like to continue your service, please update your credit/debit card below.</p>
                        </div>
                    )
                } else {
                    return (
                        <div className="sb-trial-notice">
                            <p className={"form-help-text"}><strong>{trialExpires} left of the trial. </strong> The initial payment will be charged once trial expires.</p>
                        </div>
                    )
                }
            } else {
                return (null);
            }
        } else {
            return (null);
        }
    }

    getBillingForm(instance){
        let self = this;
        let fund = self.state.funds[0];
        let buttonText = "Subscribe";
        if(fund){
            buttonText ="Update Card";
        }
        if(instance.status === "cancelled" && self.state.instances.length === 1){
            buttonText="Resubscribe"
        }
        return (
            <div>
                {self.state.funds.length === 0 || !self.state.funds[0].source ?
                    <div className="mbf--funding-card-wrapper">
                        <h5 className="form-help-text">Add your funding credit/debit card.</h5>
                        <BillingForm buttonText={buttonText}
                                     handleResponse={self.handleResponse(instance)}
                                     user={self.state.instances[0].references.users[0]}
                                     token={self.props.token} spk={self.state.spk}
                                     external={self.props.external}
                                     submitAPI={`${self.props.url}/${self.state.fund_url}`} />
                    </div>
                    :
                    <div>
                        <BillingForm handleResponse={self.handleResponse(instance)}
                                     buttonText={buttonText}
                                     user={self.state.instances[0].references.users[0]}
                                     token={self.props.token}
                                     spk={self.state.spk}
                                     external={self.props.external}
                                     submitAPI={`${self.props.url}/${self.state.fund_url}`} userFund={fund} />
                    </div>

                }
            </div>
        );
    }
    showPropEdit(instance) {
        let self = this;
        return function() {
            self.setState({propEdit: true, currentInstance : instance});
        }
    }

    hidePropEdit(e) {
        this.setState({propEdit: false});
        this.getServicebotDetails();

    }
    changePlan (paymentStructure){
        let self = this;
        return async function(e) {
            let headers = {
                "Content-Type": "application/json",
                'Accept': 'application/json'
            };
            if (self.props.token) {
                headers["Authorization"] = `JWT ${self.props.token}`;
            }

            let request = {
                method: "POST",
                headers
            }

            self.props.setLoading(true);
            // self.setState({loading: true});
            let updatedInstance = await(await fetch(`${self.props.url}/api/v1/service-instances/${self.state.instances[0].id}/apply-payment-structure/${paymentStructure}`,request)).json();
            if(updatedInstance.error === "This customer has no attached payment source"){
                self.setState({formError: "Credit/debit card required to switch from free tier to a paid tier"});
            }else if(updatedInstance.error){
                self.setState({formError: updatedInstance.error});
            }
            if(!updatedInstance.error && self.state.formError){
                self.setState({formError: null})
            }
            await self.getServicebotDetails();
            if(self.props.handleResponse){
                self.props.handleResponse({event: "change_plan", response: self.state.instances[0]});
            }
            // self.setState({loading: false});
            self.props.setLoading(false);
        }
    }

    resubscribe(id){
        return async ()=>{
            let self = this;
            self.props.setLoading(true);
            let headers = {
                "Content-Type": "application/json",
                'Accept': 'application/json'
            };
            if (this.props.token) {
                headers["Authorization"] = `JWT ${this.props.token}`;
            }

            const URL = this.props.url;
            self.setState({loading:true});
            let updatedInstance = await (await fetch(`${URL}/api/v1/service-instances/${id}/reactivate`, {
                method : "POST",
                headers
            })).json();
            if(updatedInstance.error){
                self.setState({resubscribeError: updatedInstance.error});
            }else if(self.state.resubscribeError || self.state.formError){
                self.setState({resubscribeError: null, formError: null});
            }
            await self.getServicebotDetails();
            self.props.handleResponse && self.props.handleResponse({event: "resubscribe", response: updatedInstance});
            self.props.setLoading(false);
        }
    }

    render () {

        let self = this;
        if(this.state.error){
            return <div className="subill--embeddable subill--manage-billing-form-wrapper custom">

                <div className="mbf--form-wrapper">
                    <div className="app-content">
                        <div className="mbf--subscription-summary-wrapper">
                            <h3>Subscription Summary</h3>
                            <div className="mbf--current-services-list">
                    <p>{this.state.error}</p>
                            </div></div></div>
                </div></div>

        }

        // let metricProp = self.state.template && self.state.template.references.service_template_properties.find(prop => prop.type === "metric");

        return (
            <div className="subill--embeddable subill--manage-billing-form-wrapper custom">
                <Load className={`subill-embed-custom-loader`} finishLoading={this.props.finishLoading}/>
                <div className="mbf--form-wrapper">
                    {self.state.instances.length > 0 ?
                        <div className="app-content">
                                {/*todo: style this when it's available or designed */}
                                {self.state.instances.length > 0 ?
                                    <div className="mbf--subscription-summary-wrapper">
                                        <h3>Subscription Summary</h3>
                                            <div className="mbf--current-services-list">
                                                {self.state.instances.map(service => {
                                                    let template = self.state.templates[service.service_id];
                                                    let tier = service.references.payment_structure_templates[0] && template.references.tiers.find(tier => tier.id === service.references.payment_structure_templates[0].tier_id);

                                                    let metricProp = service.references.service_instance_properties.find(prop => prop.type === "metric");
                                                    return(
                                                    <div key={`service-list-${service.service_id}`} className="mbf--current-services-item">
                                                        {this.getSubscriptionStatus(service)}
                                                        {this.getTrialStatus(service)}
                                                        <PriceBreakdown tier={tier} metricProp={metricProp} instance={service}/>
                                                        {this.state.formError && <h3 style={{color:"red"}}>{this.state.formError}</h3>}
                                                        <TierChoose disablePlanChange={self.props.disablePlanChange} key={"t-" + service.payment_structure_template_id}  changePlan={self.changePlan} currentPlan={service.payment_structure_template_id} template={template}/>
                                                        <div className="mbf--current-services-item-buttons">
                                                            {this.state.resubscribeError && <span style={{color:"red"}}>{this.state.resubscribeError}</span>}

                                                            {(service.status === "running" || service.status === "requested" || service.status === "in_progress") &&
                                                            <button className="buttons _right _rounded mbf--btn-cancel-service"
                                                                    onClick={this.requestCancellation.bind(this, service.id)}>Cancel Service</button>
                                                            }
                                                            {(service.status === "cancelled" || service.status === "cancellation_pending") && self.state.funds[0] &&
                                                            <button className="buttons _right _rounded mbf--btn-resubscribe-service"
                                                                    onClick={self.resubscribe(service.id)}>Resubscribe</button>}
                                                            <div className={`clear`}/>
                                                        </div>
                                                    </div>
                                                )})}
                                            </div>
                                        </div>
                                    :
                                    <div><p>You currently don't have any subscriptions.</p></div>
                                }
                                <h3>Payment Information</h3>
                                {this.getBillingForm(self.state.instances[0])}

                                <ModalEditProperties external={this.props.external} token={this.props.token} url={this.props.url} instance={self.state.instances[0]} refresh={this.hidePropEdit}/>
                            {self.state.instances[0] && <Invoices user={self.state.instances[0].references.users[0]} invoices={this.state.invoices} spk={this.state.spk}/>}
                        </div>
                        :
                        <Load finishLoading={this.props.finishLoading}>
                            <p className="page-loader-text">Billing Management</p>
                        </Load>
                    }
                </div>
            </div>
        );
    }
}

let mapDispatchToProps = function(dispatch){
    return {
        setLoading : function(is_loading){
            dispatch({type: "SET_LOADING", is_loading});
        }}
}

ServicebotManagedBilling = connect(null, mapDispatchToProps)(ServicebotManagedBilling);
export default ServicebotManagedBilling