from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect
import json
import sys

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

servers=[]
for path in sys.argv[1:3]:
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=path))
    Thread(target=server.serve_forever,daemon=True).start()
    servers.append('http://127.0.0.1:'+str(server.server_port))

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    out=Path('test-output')
    out.mkdir(exist_ok=True)
    results=[]
    for origin in servers:
        page=browser.new_page(accept_downloads=True,viewport={'width':1440,'height':1000})
        page.set_default_timeout(4500)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(origin+'/paint-calculator/')
        expect(page.locator('#quickChoice')).to_have_attribute('aria-pressed','true')
        area=page.locator('[data-fields="area"] input')
        select=page.locator('[data-fields="area"] select')
        v=page.locator('#result-value')
        quick=[v.inner_text()]
        for value in ['', '-1']:
            area.nth(0).fill(value)
            expect(page.locator('#result-label')).to_have_text('Check your input')
        area.nth(0).fill('1000')
        area.nth(1).fill('400')
        expect(v).to_have_text('5.5 gallons')
        quick.append(v.inner_text())
        select.nth(0).select_option(label='sq m')
        select.nth(1).select_option(label='sq m per liter')
        area.nth(0).fill('100')
        area.nth(1).fill('10')
        quick.append(v.inner_text())
        select.nth(0).select_option(label='sq ft')
        select.nth(1).select_option(label='sq ft per gallon')
        area.nth(0).fill('1000')
        area.nth(1).fill('400')
        page.locator('[data-mode=coverage]').click()
        expect(v).to_have_text('350 sq ft')
        quick.append(v.inner_text())
        page.locator('[data-mode=cost]').click()
        costs=page.locator('[data-panel=cost] input')
        costs.nth(1).fill('10')
        costs.nth(2).fill('0')
        expect(v).to_have_text('$40.00')
        quick.append(v.inner_text())
        page.locator('[data-mode=needed]').click()
        page.locator('[data-mp-share=print]').click()
        expect(page).to_have_url(origin+'/print/paint-calculator/')
        assert '5.5' in page.locator('body').inner_text()
        assert page.pdf().startswith(b'%PDF')
        page.goto(origin+'/paint-calculator/')
        area.nth(0).fill('1000')
        area.nth(1).fill('400')
        page.locator('#advancedChoice').click()
        assert '5.5 US gal' in page.locator('#pp-breakdown').text_content()
        page.locator('#pp-method').select_option('room')
        breakdown=page.locator('#pp-breakdown')
        assert '435 sq ft' in breakdown.text_content()
        base_breakdown=breakdown.text_content()
        page.locator('#pp-units').select_option('metric')
        assert 'm²' in breakdown.text_content()
        page.locator('#pp-units').select_option('imperial')
        assert breakdown.text_content()==base_breakdown
        if origin==servers[0]:
            results.append({'quick':quick,'room':base_breakdown})
            assert not errors,errors
            page.close()
            continue
        step=page.locator('.planner-steps [aria-current=step]')
        expect(step).to_contain_text('Measurements')
        height=page.locator('.planner-viewport').bounding_box()['height']
        page.locator('#pp-length').fill('')
        page.locator('#pp-next').click()
        expect(step).to_contain_text('Measurements')
        expect(page.locator('#pp-error')).to_contain_text('Length')
        page.locator('#pp-length').fill('15')
        page.locator('#pp-name').fill('Hall paint')
        page.locator('#pp-next').press('Enter')
        expect(step).to_contain_text('Materials')
        expect(page.locator('#pp-materials-title')).to_be_focused()
        assert len(page.locator('[data-planner-step]:visible').all())==1
        page.locator('#pp-primer').check()
        page.locator('#pp-newName').fill('Spare tray')
        page.locator('#pp-add').click()
        row=page.locator('#pp-materials .hi-material').filter(has_text='Spare tray')
        expect(row).to_be_visible()
        row.get_by_label('Purchase quantity',exact=False).fill('2')
        page.locator('#pp-next').click()
        expect(step).to_contain_text('Budget')
        price=page.get_by_label('Unit price USD / each — Spare tray')
        price.fill('6')
        page.locator('#pp-additional').fill('4')
        page.locator('#pp-contingency').fill('10')
        page.locator('#pp-next').click()
        expect(step).to_contain_text('Results')
        expect(page.locator('#pp-shopping')).to_contain_text('Spare tray: 2 each')
        expect(page.locator('#pp-budget')).to_contain_text('$17.60')
        assert page.locator('.planner-viewport').bounding_box()['height']==height
        for size in ['letter','a4']:
            with page.expect_download() as event:
                page.locator('#pp-'+size).click()
            data=Path(event.value.path()).read_bytes()
            assert data.startswith(b'%PDF') and b'Spare tray' in data
        page.evaluate('window.print=()=>{window.paintPrintCalled=true}')
        page.locator('#pp-print').click()
        assert page.evaluate('window.paintPrintCalled')
        expect(page.locator('#hi-project-print')).to_contain_text('Hall paint')
        page.locator('#quickChoice').click()
        expect(area.nth(0)).to_have_value('1000')
        page.locator('#advancedChoice').click()
        expect(step).to_contain_text('Results')
        page.locator('#pp-next').click()
        expect(page.locator('#pp-name')).to_have_value('Hall paint')
        page.locator('#pp-length').fill('18')
        page.locator('#pp-next').click()
        page.locator('#pp-next').click()
        expect(price).to_have_value('6')
        page.locator('#pp-back').click()
        expect(step).to_contain_text('Materials')
        page.locator('#pp-next').click()
        page.locator('#pp-next').click()
        assert '489 sq ft' in breakdown.text_content()
        page.locator('#pp-next').click()
        page.locator('.planner-viewport').evaluate('(el)=>el.scrollTop=0')
        page.screenshot(path=out/'Paint-Planner-desktop.png',full_page=True)
        page.locator('#quickChoice').click()
        for width,height in [(1440,1000),(820,1180),(390,844),(320,800)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('window.scrollTo(0,0)')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert page.locator('.paint-tool-card').count()==6
            assert page.locator('.paint-tool-card a').count()==0
            page.locator('.paint-tool-card').last.scroll_into_view_if_needed()
            for img in page.locator('.paint-tool-card img').all():
                img.scroll_into_view_if_needed()
                expect(img).to_have_js_property('complete',True)
                assert img.evaluate('el=>el.naturalWidth')==512
            page.evaluate('window.scrollTo(0,0)')
            if width in [1440,390]:
                page.screenshot(path=out/('Paint-Quick-desktop.png' if width==1440 else 'Paint-Quick-mobile.png'),full_page=True)
            page.locator('#advancedChoice').click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if width==390:
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path=out/'Paint-Planner-mobile.png',full_page=True)
            page.locator('#quickChoice').click()
        assert page.locator('h1').count()==1
        assert page.locator('link[rel=canonical]').get_attribute('href')=='https://homeimprovement.tools/paint-calculator/'
        expect(page.locator('meta[name=robots]')).to_have_attribute('content','noindex,nofollow')
        expect(page.locator('#shared-header')).to_be_visible()
        expect(page.locator('footer')).to_be_visible()
        page.locator('.calc-faq summary').last.click()
        expect(page.locator('.calc-faq details').last).to_have_attribute('open','')
        assert not errors,errors
        results.append({'quick':quick,'room':base_breakdown})
    assert results[0]==results[1],results
    report=json.dumps({'success':True,'baselineMatches':results[1],'widths':[1440,820,390,320],'checked':'Quick modes, metric, invalid input, print preview/PDF, all planner steps, inventory, budget, A4/Letter, report printing, keyboard, mode state, mobile, six cards, shared header/footer, FAQ, canonical and noindex'},indent=2)
    (out/'browser-results.json').write_text(report)
    print(report)
    browser.close()
