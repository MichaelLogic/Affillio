import { Affillio } from './affillio';
import AfloBaseCtrl from './../base';
import * as _ from 'lodash';
import HunterModel from './hunter.model'
import cheerio from 'cheerio'

export default class HunterCtrl extends AfloBaseCtrl {
	model = HunterModel;
	// Hunt the partner source for a list of Suggested Goods.

	huntForGoods = (req, res) => {
		console.log("Hunt For Goods Service >> ", req.params.id);
		Affillio.hunt('TestHunterMan','launch_parts').main((hunt,requestWrap,params) => {
			requestWrap.get('www.MichaelLogic.com', (err,res,body) => {
				let $;
				let partObjs = [];

				if(err){
					hunt.fail(err, 'Hunt returned an error.');
					return;
				}

				//$= cheerio.load(body);

				//Process the kill
				console.log("Raw Kill >> ", body);

				//hunt.success();
			});
		});
		//this.index(req, res);
	}



}