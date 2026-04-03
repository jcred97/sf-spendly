import { LightningElement, api } from 'lwc';

export default class SpendlyBarChart extends LightningElement {
    @api title = '';
    @api chartData = [];
    @api emptyMessage = 'No data for current filters';

    get hasData() {
        return this.chartData.length > 0;
    }
}
