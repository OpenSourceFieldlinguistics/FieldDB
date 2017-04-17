import { CALL_API, CHAIN_API } from 'middleware/api'

import * as actionCreator from './actions'
// import * as ActionType from 'actions/corpora'

describe('Action::CorpusMask', function() {
  describe('#loadCorpusMaskDetail({id})', function() {
    let dbname = 'the-dbname'
    it('returns a CHAIN_API to fetch corpusMask first', function() {
      let action = actionCreator.loadCorpusMaskDetail({
        dbname
      })
      let callApi = action[CHAIN_API][0]()[CALL_API]
      expect(callApi.method).to.equal('get')
      expect(callApi.path).to.equal(`/api/corpora/${dbname}`)
      expect(callApi.successType).to.equal(actionCreator.LOADED_CORPUS_MASK_DETAIL)
    })
    it('navigates to root when request error', () => {
      let mockHistory = {
        push: sinon.stub()
      }
      let action = actionCreator.loadCorpusMaskDetail({
        dbname,
        history: mockHistory
      })
      let callApi = action[CHAIN_API][0]()[CALL_API]
      expect(callApi.afterError).to.be.an.instanceOf(Function)
      callApi.afterError()

      expect(mockHistory.push).to.have.been.calledWith('/')
    })
    it('fetches team data after fetching corpusMask', function() {
      let action = actionCreator.loadCorpusMaskDetail({
        dbname
      })
      let corpusMaskRes = {
        team: {
          id: '1234'
        }
      }

      expect(action[CHAIN_API][1](corpusMaskRes)[CALL_API]).to.deep.equal({
        method: 'get',
        path: `/api/teams/${corpusMaskRes.team.id}`,
        successType: actionCreator.LOADED_CORPUS_MASK_USER
      })
    })
  })
})
