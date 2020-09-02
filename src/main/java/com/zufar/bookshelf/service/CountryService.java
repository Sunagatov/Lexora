package com.zufar.bookshelf.service;

import com.zufar.bookshelf.entity.Country;
import com.zufar.bookshelf.repository.CountryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class CountryService {

    private final CountryRepository countryRepository;

    public Country get(Long id) {
        return countryRepository.getOne(id);
    }

    public List<Country> getAll() {
        return countryRepository.findAll();
    }

    public void save(Country country){
        log.info("Saving {} was successful", countryRepository.save(country));
    }

    public void update(Country country) {
        log.info("Updating {} was successful", countryRepository.save(country));
    }
}