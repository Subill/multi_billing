import React from 'react';
import {ServicebotBaseForm, widgetField} from "servicebot-base-form";
import {required, url} from 'redux-form-validators'
import {Field, FieldArray, getFormValues} from 'redux-form'
import Buttons from "../utilities/buttons.js";
import getWidgets from "../core-input-types/client";
import {getPriceData} from "../core-input-types/client";
import {connect} from "react-redux";
import {Price} from '../utilities/price.js';
import {getBasePrice} from "../widget-inputs/handleInputs";



let selectAffectPricing = function(prop){
    if(!prop.config || !prop.config.pricing || !prop.config.pricing.value){
        return false;
    }
    return Object.values(prop.config.pricing.value).some(price => price != 0)
}
let renderCustomProperty = (props) => {
    const {fields, formJSON, meta: {touched, error}} = props;
    let widgets = getWidgets().reduce((acc, widget) => {
        acc[widget.type] = widget;
        return acc;
    }, {});
    return (
       //
        <div className="add-on-item-widgets">
            {fields.map((customProperty, index) => {
                let prop = fields.get(index);
                    if(!prop.config || !prop.config.pricing || prop.type === "metric" || (prop.type === "select" && !selectAffectPricing(prop))){
                        return <div key={`custom-props-${index}`}/>
                    }
                    let property = widgets[prop.type];
                    if(prop.prompt_user){

                        return (
                            <div key={`custom-props-${index}`} className={`_add-on-item-widget-wrapper _add-on-item-${index}`}>
                                <Field
                                    key={index}
                                    currency={props.currency}
                                    name={`${customProperty}.data.value`}
                                    type={prop.type}
                                    widget={property.widget}
                                    component={widgetField}
                                    label={prop.prop_label}
                                    // value={formJSON[index].data.value}
                                    formJSON={prop}
                                    configValue={prop.config}
                                    validate={required()}
                                />
                            </div>
                        );
                    }else{
                        if(prop.data && prop.data.value){
                            return (
                                <div key={`custom-props-${index}`} className={`_add-on-item-widget-wrapper _add-on-item-${index}`}>
                                    <div className={`sb-form-group`}>
                                        {(prop.prop_label && prop.type !== 'hidden') &&
                                        <label className="_label-">{prop.prop_label}</label>}
                                        <div className="_input-container-">
                                            <p>{prop.data.value}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }else{
                            return (
                                <span key={`custom-props-${index}`}/>
                            );
                        }


                    }

                }
            )}
        </div>
    )
};





function CustomFieldEditForm(props) {
    let handlers = getWidgets().reduce((acc, widget) => {
        acc[widget.type] = widget.handler;
        return acc;

    }, {});
    let {invalid, submitting, pristine} = props;

    let properties = props.formJSON.service_instance_properties.filter(prop => {
        return prop.type !== "select" || selectAffectPricing(prop)
    });
    let basePrice = getBasePrice(props.instance.references.service_instance_properties, handlers, (props.instance.payment_plan && props.instance.payment_plan.body.data.amount) || 0);
    let priceData = getPriceData(basePrice, properties);
    return (
        <form>
            {priceData && priceData.adjustments && priceData.adjustments.length > 0 && <div>
            <h3>Subscription Add Ons</h3>

            <FieldArray
                currency={(props.instance.payment_plan && props.instance.payment_plan.body.data.currency) || "NGN"}
                name="service_instance_properties" component={renderCustomProperty}
                        formJSON={properties}/>

            <div className="add-on-item-update-submit">
                <p>
                    <label>Total Cost:</label>
                </p>
               <p>
                    <Price className="_total-price" currency={(props.instance.payment_plan && props.instance.payment_plan.body.data.currency) || "NGN"} value={priceData.total} />
                    <span className="_unit"><span className="_per">/</span>{props.instance.payment_plan.body.data.interval}</span>
                    <button disabled={invalid|| submitting || pristine} className="buttons _primary" onClick={props.handleSubmit} type="submit" value="submit">Submit</button>
                </p>
            </div>
            </div>}
        </form>
    )
}
function mapStateToProps(state) {
    return {
        formJSON: getFormValues("edit_properties_form")(state)
    }
}


CustomFieldEditForm = connect(mapStateToProps)(CustomFieldEditForm);


function ModalEditProperties(props){
    let {url, token, show, refresh, instance, handleSuccessResponse, handleFailureResponse, external} = props;
    let submissionRequest = {
        'method': 'POST',
        'url': `${url}/api/v1/service-instances/${instance.id}/change-properties`
    };



    return (
            <div className={`subill-subscription-add-ons`}>
                <ServicebotBaseForm
                    form={CustomFieldEditForm}
                    //todo: is there a way to not need initial values to reference a prop name? (for array of X cases)
                    initialValues={{"service_instance_properties" : instance.references.service_instance_properties}}
                    submissionRequest={submissionRequest}
                    successMessage={"Properties edited successfully"}
                    handleResponse={refresh}
                    // handleFailure={handleFailureResponse}
                    formName={"edit_properties_form"}
                    formProps={{instance}}
                    token={token}
                    external={external}
                    reShowForm={true}

                />
            </div>
    )

}


export {ModalEditProperties}