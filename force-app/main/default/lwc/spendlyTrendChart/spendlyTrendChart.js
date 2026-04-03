import { LightningElement, api } from 'lwc';

export default class SpendlyTrendChart extends LightningElement {
    @api title = 'Monthly Trend';
    @api trendData = [];
    @api emptyMessage = 'No trend data available';

    get hasData() {
        return this.trendData.length > 0;
    }
}
