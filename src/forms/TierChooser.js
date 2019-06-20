import React from 'react';
let _ = require('lodash');

const numberWithCommas = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
const intervalNames = {
    "one_time" : "One Time",
    "monthly" : "Monthly",
    "annually" : "Annually",
    "biannually" : "BiAnnually",
    "daily" : "Daily",
    "weekly" : "Weekly"
};


const findMonthlyPrice = (x, interval) => {
    switch(interval){
        case "monthly":
            return x;
        case "daily":
            return x * 30
        case "weekly":
            return x * 4
        case "biannually":
            return Math.floor(x/6);
        case "annually":
            return Math.floor(x/12);
    }
}

const Tier = (props) => {
    let {currentPlan, tier, plan, pickTier, isCurrent, isSelected, disablePlanChange} = props;
    let tierContent, tierButton;
    let formatter = new Intl.NumberFormat("en-US", { style: 'currency', currency: plan.currency || "NGN" }).format;

    let tierPrice = formatter(findMonthlyPrice(plan.amount, plan.interval)/100);
    if(plan.trial_period_days > 0){
        tierButton = "Try for Free"
    }else{
        tierButton = "Get Started"
    }
    if(plan.type === "subscription"){
        if(tier.unit){
            tierContent = <span>
                {tierPrice}
                <span className="_interval-name">/Month</span>
                <span className="_metered-unit">per {tier.unit}</span>
                {plan.interval !== "monthly" && <span className={`_billing-period`}>Billed {intervalNames[plan.interval]}</span>}
            </span>;
        }else{

            tierContent = <span>{tierPrice}<span className="_interval-name">/Month</span>{plan.interval !== "month" && <span className={`_billing-period`}>Billed {intervalNames[plan.interval]}</span>}<span></span></span>;
        }
        if(plan.amount == 0){
            tierContent = "Free";
        }
    }
    if(plan.type === "one_time"){
        if(plan.amount == 0){
            tierContent = "Free";
        }else{
            tierContent = `${tierPrice}`;
        }
    }
    if(plan.type === "custom"){
        tierContent = "Contact";
        tierButton = "Contact Sales";
    }
    tierButton = "Change Plan"
    return(
        <div className={`_tier ${isCurrent ? '_current' : ''} ${isSelected ? '_selected' : ''}`}>
            <h2 className="_name">{tier.name}</h2>
            <span className="_price">{tierContent}</span>
            {isCurrent && <button className="_selected-label buttons rounded" disabled>Current Plan</button>}
            {!disablePlanChange && !isSelected && !isCurrent && <button onClick={pickTier(plan.id)} className="_select-tier buttons rounded">{tierButton}</button>}
            <div className="_tier-confirm-wrapper">
                {isSelected && !isCurrent && <button onClick={props.changePlan} className="_confirm-tier buttons rounded" aria-label="confirm change plan"><span className="icon check"/></button>}
                {isSelected && !isCurrent && <button onClick={pickTier(currentPlan)} className="_confirm-tier _cancel-tier buttons rounded" aria-label="cancel change plan"><span className="icon close"/></button>}
            </div>
            {/*<ul className="_feature-list">*/}
                {/*{tier.features.map(feature => {*/}
                    {/*return (<li className="_item">{feature}</li>);*/}
                {/*})}*/}
            {/*</ul>*/}
        </div>
    );
}



const IntervalPicker = (props)=> {

    return (
        <ul className="_selector">
            {props.intervals.sort((a, b) => {
                if(a === "annually" || b === "one_time"){
                    return 1;
                }
                if(a === "one_time" || b === "annually"){
                    return -1;
                }
                if(a === "monthly"){
                    return 1;
                }
                if(b === "monthly"){
                    return -1
                }
                if(a === "weekly"){
                    return 1
                }
                if(a === "daily"){
                    return -1
                }

            }).map(interval => {
                let intervalClass = "_interval";
                if(props.currentInterval === interval){
                    intervalClass+=" _selected";
                }

                return (<li key={`interval-${intervalNames[interval]}`} className={intervalClass} onClick={props.changeInterval(interval)}>{intervalNames[interval]}</li>)
            })
            }
        </ul>
    );
};
class TierSelector extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            tiers: [],
            paymentPlans: {},
            currentInterval: null,
            currentPlan: props.currentPlan,
            selectedPlan: props.currentPlan
        }
        this.changeInterval = this.changeInterval.bind(this);
        this.pickTier = this.pickTier.bind(this);

    }

    pickTier(paymentPlan){
        let self = this;
        return function(e){
            self.setState({selectedPlan : paymentPlan});
        }
    }
    async componentDidMount() {
        let {template, currentPlan} = this.props;
        let metricProp = template.references.service_template_properties.find(prop => prop.type === "metric");
        let tiers = template.references.tiers;
        if(metricProp) {
            tiers = template.references.tiers.map((tier, index )=> {
                if (metricProp.config.pricing.tiers && metricProp.config.pricing.tiers.includes(tier.name)) {
                    tier.unit = metricProp.config.unit;
                }
                return tier
            });
        }
        let currentInterval = null;
        let paymentPlans = tiers.reduce(( acc, tier) => {
            return acc.concat(tier.references.payment_structure_templates);
        }, []).reduce((acc, plan)=> {
            if(plan.id === currentPlan){
                currentInterval = plan.interval;
            }
            acc[plan.type] = [plan].concat(acc[plan.type] || []);
            return acc;
        }, {});
        this.setState({tiers, paymentPlans, currentInterval})
    }
    changeInterval(currentInterval){
        let self = this;
        return function(e){
            self.setState({currentInterval})
        }
    }
    render(){
        let {tiers, currentInterval, currentPlan, selectedPlan, paymentPlans : {subscription, custom, one_time}} = this.state;
        let currentPlans = custom || [];
        let intervals = new Set([]);
        let self = this;
        let checkoutConfig = {};
        if(one_time){
            intervals.add("one_time");
        }
        if(subscription){
            subscription.forEach(sub => {
                intervals.add(sub.interval);
            })
        }
        let intervalArray = Array.from(intervals);
        if(subscription && currentInterval !== "one_time"){
            subscription = subscription.sort((a, b) => {
                return b.amount - a.amount;
            }).reduce((acc, sub) => {
                acc[sub.interval] = [sub].concat(acc[sub.interval] || []);
                return acc;
            }, {});
            currentPlans = subscription[currentInterval || intervalArray[0]].concat(currentPlans);
        }
        if(currentInterval === "one_time"){
            one_time.sort((a, b)=> {
                return b.amount-a.amount;
            });
            currentPlans = one_time.concat(currentPlans);
        }
        currentPlans = currentPlans.filter(plan => plan.type !== "custom");

        return (
            <div className={`subill-subscription`}>
                <h3>Subscription</h3>
                <div className="subill-billing-type-selector">
                    {currentInterval && currentInterval!== "custom" && <IntervalPicker changeInterval={this.changeInterval} currentInterval={currentInterval} intervals={intervalArray}/>}
                </div>
                {currentInterval !== "custom" && <div className="subill-pricing-table">
                    {_.sortBy(currentPlans, ['amount', 'id']).map(plan => {
                        if(plan.type === "custom"){
                            return <div></div>
                        }
                        let props = {
                            pickTier: self.pickTier,
                            key: plan.id,
                            tier: tiers.find(tier => tier.id === plan.tier_id),
                            plan: plan,
                            currentPlan,
                            changePlan: self.props.changePlan(plan.id),
                            disablePlanChange: self.props.disablePlanChange
                        }

                        if (plan.id === currentPlan) {
                            props.isCurrent = true;
                        }
                        if (plan.id === selectedPlan) {
                            props.isSelected = true;
                        }
                        return <Tier key={`plan-${plan.id}`} {...props}/>
                    })}
                </div>
                }
                {currentInterval === "custom" && <p>Enterprise Plan</p>}

            </div>
        );
    }
}
export default TierSelector